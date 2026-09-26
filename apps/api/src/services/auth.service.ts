import {
  COACH_PROFILE_FIELDS,
  ERROR_CODE,
  MEMBER_PROFILE_FIELDS,
  type ChangePasswordBody,
  type ErrorCode,
  type LoginBody,
  type RegisterBody,
  type ResetPasswordBody,
  type SendOtpBody,
  type UpdateMeBody,
  type UploadPurpose,
} from '@sports-center/shared';

import { prisma } from '~/configs/db';
import { AUTH } from '~/constants/auth';
import { HTTP_STATUS } from '~/constants/httpStatus';
import type { OtpPurpose, Prisma, Role } from '~/generated/prisma/client';
import { toAccountResponse } from '~/mappers/account.mapper';
import accountRepository from '~/repositories/account.repository';
import otpRepository from '~/repositories/otp.repository';
import refreshTokenRepository from '~/repositories/refreshToken.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import mailService from '~/services/mail.service';
import notificationService from '~/services/notification.service';
import uploadService from '~/services/upload.service';
import { verifyCaptcha } from '~/utils/captcha';
import { isUniqueViolation } from '~/utils/dbError';
import { signAccessToken } from '~/utils/jwt';
import { hashPassword, verifyPassword } from '~/utils/password';
import { generateOpaqueToken, generateOtp, hashToken, safeEqual } from '~/utils/token';

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

const DUMMY_PASSWORD_HASH = '$2b$12$SEvy3IQfyF7ckWidOI9vuuK7OSqjxXI1X/MCEfh52T3jfMglIeK/q';

const fail = (status: number, code: ErrorCode, message: string) => new ErrorWithStatus({ status, code, message });

type ProfileFields = NonNullable<UpdateMeBody['profile']>;

const pickDefined = <K extends keyof ProfileFields>(profile: ProfileFields | undefined, keys: readonly K[]) => {
  if (!profile) return undefined;
  const picked: Partial<Pick<ProfileFields, K>> = {};
  for (const key of keys) {
    if (profile[key] !== undefined) picked[key] = profile[key];
  }
  return Object.keys(picked).length > 0 ? picked : undefined;
};

class AuthService {
  sendOtp = async ({ email, purpose, captchaToken }: SendOtpBody, ip?: string) => {
    if (!(await verifyCaptcha(captchaToken, ip))) {
      throw fail(HTTP_STATUS.BAD_REQUEST, ERROR_CODE.CAPTCHA_FAILED, 'Xác thực captcha thất bại');
    }

    const exists = await accountRepository.existsByEmail(email);
    if (purpose === 'REGISTER' && exists) {
      throw fail(HTTP_STATUS.CONFLICT, ERROR_CODE.EMAIL_TAKEN, 'Email đã được đăng ký');
    }
    if (purpose === 'PASSWORD_RESET' && !exists) {
      throw fail(HTTP_STATUS.NOT_FOUND, ERROR_CODE.EMAIL_NOT_FOUND, 'Email chưa được đăng ký');
    }

    const latest = await otpRepository.findLatestActive(email, purpose);
    if (latest) {
      const elapsed = (Date.now() - latest.createdAt.getTime()) / 1000;
      if (elapsed < AUTH.OTP_RESEND_COOLDOWN) {
        const retryAfter = Math.ceil(AUTH.OTP_RESEND_COOLDOWN - elapsed);
        throw new ErrorWithStatus({
          status: HTTP_STATUS.TOO_MANY_REQUESTS,
          code: ERROR_CODE.OTP_COOLDOWN,
          message: `Vui lòng đợi ${retryAfter} giây để gửi lại mã`,
          meta: { retryAfter },
        });
      }
    }

    const code = generateOtp();
    await otpRepository.invalidateAll(email, purpose);
    await otpRepository.create({
      email,
      purpose,
      codeHash: hashToken(code),
      expiresAt: new Date(Date.now() + AUTH.OTP_TTL * 1000),
    });
    await mailService.sendOtp(email, purpose, code);
  };

  register = async ({ email, otp, fullName, password }: RegisterBody, meta: SessionMeta) => {
    const record = await this.verifyOtp(email, 'REGISTER', otp);

    if (await accountRepository.existsByEmail(email)) {
      throw fail(HTTP_STATUS.CONFLICT, ERROR_CODE.EMAIL_TAKEN, 'Email đã được đăng ký');
    }

    const passwordHash = await hashPassword(password);
    const refreshToken = generateOpaqueToken();

    const { account, notifications } = await prisma.$transaction(async (tx) => {
      await otpRepository.consume(record.id, tx);
      const created = await accountRepository.createMember(
        { email, fullName, passwordHash, emailVerifiedAt: new Date() },
        tx,
      );
      await refreshTokenRepository.create(this.refreshTokenData(refreshToken, created.id, meta), tx);
      const notifications = await notificationService.create(
        [
          {
            accountId: created.id,
            type: 'SYSTEM',
            title: 'Chào mừng bạn đến với Sports Center',
            message:
              'Tài khoản của bạn đã được tạo thành công. Bạn có thể đặt sân, đăng ký lớp học và mua gói thành viên ngay trên hệ thống.',
            dedupKey: `welcome:${created.id}`,
            sendEmail: true,
          },
        ],
        tx,
      );
      return { account: created, notifications };
    });

    notificationService.sendEmailsAfterCommit(notifications);

    return {
      account: toAccountResponse(account),
      accessToken: signAccessToken(account.id, account.role),
      refreshToken,
    };
  };

  login = async ({ email, password }: LoginBody, meta: SessionMeta) => {
    const account = await accountRepository.findByEmail(email);
    const valid = await verifyPassword(password, account?.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (!account || !valid) {
      throw fail(HTTP_STATUS.UNAUTHORIZED, ERROR_CODE.INVALID_CREDENTIALS, 'Email hoặc mật khẩu không đúng');
    }
    if (account.status !== 'ACTIVE') {
      throw fail(HTTP_STATUS.FORBIDDEN, ERROR_CODE.ACCOUNT_INACTIVE, 'Tài khoản đã bị vô hiệu hóa');
    }

    const tokens = await this.issueTokens(account.id, account.role, meta);
    return { account: toAccountResponse(account), ...tokens };
  };

  refresh = async (rawToken: unknown, meta: SessionMeta) => {
    if (typeof rawToken !== 'string' || !rawToken) {
      throw fail(HTTP_STATUS.UNAUTHORIZED, ERROR_CODE.UNAUTHORIZED, 'Refresh token không được cung cấp');
    }

    const tokenHash = hashToken(rawToken);
    const record = await refreshTokenRepository.findByHash(tokenHash);

    if (!record) {
      throw fail(HTTP_STATUS.UNAUTHORIZED, ERROR_CODE.TOKEN_INVALID, 'Refresh token không hợp lệ');
    }
    if (record.revokedAt) {
      await refreshTokenRepository.revokeAllByAccountId(record.accountId);
      throw fail(HTTP_STATUS.UNAUTHORIZED, ERROR_CODE.TOKEN_INVALID, 'Refresh token không hợp lệ');
    }
    if (record.expiresAt < new Date()) {
      throw fail(HTTP_STATUS.UNAUTHORIZED, ERROR_CODE.TOKEN_EXPIRED, 'Refresh token đã hết hạn');
    }
    if (record.account.status !== 'ACTIVE') {
      throw fail(HTTP_STATUS.FORBIDDEN, ERROR_CODE.ACCOUNT_INACTIVE, 'Tài khoản đã bị vô hiệu hóa');
    }

    const refreshToken = generateOpaqueToken();
    await prisma.$transaction(async (tx) => {
      await refreshTokenRepository.revokeByHash(tokenHash, tx);
      await refreshTokenRepository.create(this.refreshTokenData(refreshToken, record.accountId, meta), tx);
    });

    return { accessToken: signAccessToken(record.accountId, record.account.role), refreshToken };
  };

  logout = async (rawToken: unknown) => {
    if (typeof rawToken === 'string' && rawToken) {
      await refreshTokenRepository.revokeByHash(hashToken(rawToken));
    }
  };

  logoutAll = (accountId: string) => refreshTokenRepository.revokeAllByAccountId(accountId);

  getMe = async (accountId: string) => {
    const account = await accountRepository.findById(accountId);
    if (!account) throw fail(HTTP_STATUS.NOT_FOUND, ERROR_CODE.NOT_FOUND, 'Tài khoản không tồn tại');
    return toAccountResponse(account);
  };

  updateMe = async (accountId: string, { profile, ...fields }: UpdateMeBody, ip?: string) => {
    const current = await accountRepository.findById(accountId);
    if (!current) throw fail(HTTP_STATUS.NOT_FOUND, ERROR_CODE.NOT_FOUND, 'Tài khoản không tồn tại');

    if (
      fields.phone &&
      fields.phone !== current.phone &&
      (await accountRepository.existsByPhone(fields.phone, accountId))
    ) {
      throw this.phoneTaken();
    }

    this.assertUploadedFile(fields.avatarUrl, current.avatarUrl, 'AVATAR', accountId, 'body.avatarUrl');
    if (current.role === 'COACH') {
      this.assertUploadedFile(
        profile?.coverImageUrl,
        current.coachProfile?.coverImageUrl,
        'COVER_IMAGE',
        accountId,
        'body.profile.coverImageUrl',
      );
    }

    const { dateOfBirth, ...rest } = fields;
    const account: Prisma.AccountUpdateInput = {
      ...rest,
      ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth === null ? null : new Date(dateOfBirth) }),
    };
    const memberProfile = current.role === 'MEMBER' ? pickDefined(profile, MEMBER_PROFILE_FIELDS) : undefined;
    const coachProfile = current.role === 'COACH' ? pickDefined(profile, COACH_PROFILE_FIELDS) : undefined;

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const next = await accountRepository.updateProfile(accountId, { account, memberProfile, coachProfile }, tx);
        const changes = [
          ['ACCOUNT', current, next],
          ['MEMBER_PROFILE', current.memberProfile, next.memberProfile],
          ['COACH_PROFILE', current.coachProfile, next.coachProfile],
        ] as const;
        for (const [entityType, oldValues, newValues] of changes) {
          if (!oldValues || !newValues) continue;
          await auditService.record(
            { accountId, action: 'UPDATE', entityType, entityId: accountId, oldValues, newValues, ipAddress: ip },
            tx,
          );
        }
        return next;
      });
      return toAccountResponse(updated);
    } catch (err) {
      if (isUniqueViolation(err, 'phone_key')) throw this.phoneTaken();
      throw err;
    }
  };

  changePassword = async (accountId: string, { currentPassword, password }: ChangePasswordBody) => {
    const account = await accountRepository.findById(accountId);
    if (!account || !(await verifyPassword(currentPassword, account.passwordHash))) {
      throw fail(HTTP_STATUS.BAD_REQUEST, ERROR_CODE.INVALID_CREDENTIALS, 'Mật khẩu hiện tại không đúng');
    }

    const passwordHash = await hashPassword(password);
    await prisma.$transaction(async (tx) => {
      await accountRepository.updatePassword(accountId, passwordHash, tx);
      await refreshTokenRepository.revokeAllByAccountId(accountId, tx);
    });
  };

  resetPassword = async ({ email, otp, password }: ResetPasswordBody) => {
    const record = await this.verifyOtp(email, 'PASSWORD_RESET', otp);

    const account = await accountRepository.findByEmail(email);
    if (!account) throw fail(HTTP_STATUS.NOT_FOUND, ERROR_CODE.EMAIL_NOT_FOUND, 'Email chưa được đăng ký');

    const passwordHash = await hashPassword(password);
    await prisma.$transaction(async (tx) => {
      await otpRepository.consume(record.id, tx);
      await accountRepository.updatePassword(account.id, passwordHash, tx);
      await refreshTokenRepository.revokeAllByAccountId(account.id, tx);
    });
  };

  private verifyOtp = async (email: string, purpose: OtpPurpose, code: string) => {
    const record = await otpRepository.findLatestActive(email, purpose);

    if (!record) throw fail(HTTP_STATUS.BAD_REQUEST, ERROR_CODE.OTP_INVALID, 'Mã xác nhận không đúng');
    if (record.expiresAt < new Date()) {
      throw fail(HTTP_STATUS.BAD_REQUEST, ERROR_CODE.OTP_EXPIRED, 'Mã xác nhận đã hết hạn');
    }
    if (record.attempts >= AUTH.OTP_MAX_ATTEMPTS) {
      throw fail(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODE.OTP_MAX_ATTEMPTS,
        'Bạn đã nhập sai quá nhiều lần, vui lòng gửi lại mã',
      );
    }
    if (!safeEqual(record.codeHash, hashToken(code))) {
      await otpRepository.incrementAttempts(record.id);
      throw fail(HTTP_STATUS.BAD_REQUEST, ERROR_CODE.OTP_INVALID, 'Mã xác nhận không đúng');
    }

    return record;
  };

  private assertUploadedFile = (
    url: string | null | undefined,
    currentUrl: string | null | undefined,
    purpose: UploadPurpose,
    accountId: string,
    path: string,
  ) => {
    if (!url || url === currentUrl || uploadService.isUploadedFileUrl(url, purpose, accountId)) return;
    throw new ErrorWithStatus({
      status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
      code: ERROR_CODE.VALIDATION,
      message: 'Dữ liệu không hợp lệ',
      errors: [{ path, message: 'Ảnh phải được tải lên qua hệ thống' }],
    });
  };

  private phoneTaken = () =>
    new ErrorWithStatus({
      status: HTTP_STATUS.CONFLICT,
      code: ERROR_CODE.PHONE_TAKEN,
      message: 'Số điện thoại đã được sử dụng',
      errors: [{ path: 'body.phone', message: 'Số điện thoại đã được sử dụng' }],
    });

  private issueTokens = async (accountId: string, role: Role, meta: SessionMeta) => {
    const refreshToken = generateOpaqueToken();
    await refreshTokenRepository.create(this.refreshTokenData(refreshToken, accountId, meta));
    return { accessToken: signAccessToken(accountId, role), refreshToken };
  };

  private refreshTokenData = (rawToken: string, accountId: string, meta: SessionMeta) => ({
    tokenHash: hashToken(rawToken),
    accountId,
    expiresAt: new Date(Date.now() + AUTH.REFRESH_TOKEN_TTL * 1000),
    ...meta,
  });
}

export default new AuthService();
