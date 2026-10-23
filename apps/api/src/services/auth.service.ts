import {
  COACH_PROFILE_FIELDS,
  ERROR_CODE,
  MEMBER_PROFILE_FIELDS,
  type ActivateAccountBody,
  type ActivationBody,
  type ActivationInfo,
  type ChangePasswordBody,
  type ErrorCode,
  type FirstPasswordBody,
  type LoginBody,
  type LoginStartBody,
  type LoginStartResult,
  type RegisterBody,
  type ResetPasswordBody,
  type SendOtpBody,
  type SetPasswordBody,
  type UpdateMeBody,
  type VerifyOtpBody,
} from '@sports-center/shared';
import { waitUntil } from '@vercel/functions';

import { prisma } from '~/configs/db';
import { appUrl, env } from '~/configs/env';
import { AUTH } from '~/constants/auth';
import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Prisma, Role } from '~/generated/prisma/client';
import { toAccountResponse } from '~/mappers/account.mapper';
import accountRepository, { accountProfileInclude } from '~/repositories/account.repository';
import otpRepository from '~/repositories/otp.repository';
import refreshTokenRepository from '~/repositories/refreshToken.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import mailService from '~/services/mail.service';
import notificationService from '~/services/notification.service';
import uploadService from '~/services/upload.service';
import type { ActivationReason } from '~/templates/activation.template';
import type { CodePurpose } from '~/templates/otp.template';
import { verifyCaptcha } from '~/utils/captcha';
import { isUniqueViolation } from '~/utils/dbError';
import { signAccessToken } from '~/utils/jwt';
import { pickDefined } from '~/utils/object';
import { hashPassword, verifyPassword } from '~/utils/password';
import { generateOpaqueToken, generateOtp, hashToken, safeEqual } from '~/utils/token';

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

const DUMMY_PASSWORD_HASH = '$2b$12$SEvy3IQfyF7ckWidOI9vuuK7OSqjxXI1X/MCEfh52T3jfMglIeK/q';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fail = (status: number, code: ErrorCode, message: string) => new ErrorWithStatus({ status, code, message });

const invalidActivation = () =>
  fail(
    HTTP_STATUS.BAD_REQUEST,
    ERROR_CODE.TOKEN_INVALID,
    'Link kích hoạt không còn dùng được, vui lòng đăng nhập bằng email để nhận mã',
  );

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

    const retryAfter = await this.otpCooldown(email, purpose);
    if (retryAfter) {
      throw new ErrorWithStatus({
        status: HTTP_STATUS.TOO_MANY_REQUESTS,
        code: ERROR_CODE.OTP_COOLDOWN,
        message: `Vui lòng đợi ${retryAfter} giây để gửi lại mã`,
        meta: { retryAfter },
      });
    }
    await this.issueOtp(email, purpose);
  };

  loginStart = async ({ email }: LoginStartBody): Promise<LoginStartResult> => {
    const account = await accountRepository.findByEmail(email);
    if (!account || account.status !== 'ACTIVE' || !account.mustSetPassword) return { next: 'PASSWORD' };

    const retryAfter = await this.otpCooldown(email, 'ACCOUNT_SETUP');
    if (retryAfter) return { next: 'SET_PASSWORD', retryAfter };
    await this.issueOtp(email, 'ACCOUNT_SETUP');
    return { next: 'SET_PASSWORD', retryAfter: AUTH.OTP_RESEND_COOLDOWN };
  };

  checkOtp = async ({ email, purpose, otp }: VerifyOtpBody) => {
    await this.verifyOtp(email, purpose, otp);
  };

  setPassword = async ({ email, otp, password }: SetPasswordBody, meta: SessionMeta) => {
    const record = await this.verifyOtp(email, 'ACCOUNT_SETUP', otp);
    const account = await accountRepository.findByEmail(email);
    if (!account || !account.mustSetPassword) {
      throw fail(HTTP_STATUS.CONFLICT, ERROR_CODE.INVALID_STATE, 'Tài khoản đã có mật khẩu, vui lòng đăng nhập');
    }
    if (account.status !== 'ACTIVE') {
      throw fail(HTTP_STATUS.FORBIDDEN, ERROR_CODE.ACCOUNT_INACTIVE, 'Tài khoản đã bị vô hiệu hóa');
    }

    const passwordHash = await hashPassword(password);
    const updated = await prisma.$transaction(async (tx) => {
      await otpRepository.consume(record.id, tx);
      await refreshTokenRepository.revokeAllByAccountId(account.id, tx);
      return accountRepository.setOwnPassword(account, passwordHash, tx);
    });

    const tokens = await this.issueTokens(updated.id, updated.role, meta);
    return { account: toAccountResponse(updated), ...tokens };
  };

  setFirstPassword = async (accountId: string, { password }: FirstPasswordBody, meta: SessionMeta) => {
    const account = await accountRepository.findById(accountId);
    if (!account || !account.mustSetPassword) {
      throw fail(HTTP_STATUS.CONFLICT, ERROR_CODE.INVALID_STATE, 'Tài khoản đã có mật khẩu');
    }
    if (account.status !== 'ACTIVE') {
      throw fail(HTTP_STATUS.FORBIDDEN, ERROR_CODE.ACCOUNT_INACTIVE, 'Tài khoản đã bị vô hiệu hóa');
    }

    const passwordHash = await hashPassword(password);
    const updated = await prisma.$transaction(async (tx) => {
      await refreshTokenRepository.revokeAllByAccountId(account.id, tx);
      return accountRepository.setOwnPassword(account, passwordHash, tx);
    });

    const tokens = await this.issueTokens(updated.id, updated.role, meta);
    return { account: toAccountResponse(updated), ...tokens };
  };

  createActivationLink = async (email: string, tx: Prisma.TransactionClient) => {
    const secret = generateOpaqueToken();
    await otpRepository.invalidateAll(email, 'ACCOUNT_ACTIVATION', tx);
    const record = await otpRepository.create(
      {
        email,
        purpose: 'ACCOUNT_ACTIVATION',
        codeHash: hashToken(secret),
        expiresAt: new Date(Date.now() + AUTH.ACTIVATION_TTL * 1000),
      },
      tx,
    );
    return `${appUrl}/activate?token=${record.id}.${secret}`;
  };

  sendActivationAfterCommit = (to: string, fullName: string, url: string, reason: ActivationReason) => {
    waitUntil(
      mailService.sendActivation(to, fullName, url, reason).catch((err) => {
        console.error('Failed to send activation email:', err);
      }),
    );
  };

  checkActivation = async ({ token }: ActivationBody): Promise<ActivationInfo> => {
    const { account } = await this.findActivation(token);
    return { email: account.email, fullName: account.fullName };
  };

  activate = async ({ token, password }: ActivateAccountBody, meta: SessionMeta) => {
    const { record, account } = await this.findActivation(token);

    const passwordHash = await hashPassword(password);
    const updated = await prisma.$transaction(async (tx) => {
      const { count } = await otpRepository.consumeIfActive(record.id, tx);
      if (count === 0) throw invalidActivation();
      await refreshTokenRepository.revokeAllByAccountId(account.id, tx);
      return accountRepository.setOwnPassword(account, passwordHash, tx);
    });

    const tokens = await this.issueTokens(updated.id, updated.role, meta);
    return { account: toAccountResponse(updated), ...tokens };
  };

  register = async ({ email, otp, fullName, password }: RegisterBody, meta: SessionMeta) => {
    const record = await this.verifyOtp(email, 'REGISTER', otp);

    if (await accountRepository.existsByEmail(email)) {
      throw fail(HTTP_STATUS.CONFLICT, ERROR_CODE.EMAIL_TAKEN, 'Email đã được đăng ký');
    }

    const passwordHash = await hashPassword(password);
    return this.createMemberWithSession(
      { email, fullName, passwordHash, emailVerifiedAt: new Date() },
      {
        message:
          'Tài khoản của bạn đã được tạo thành công. Bạn có thể đặt sân, đăng ký lớp học và mua gói thành viên ngay trên hệ thống.',
        sendEmail: true,
      },
      meta,
      (tx) => otpRepository.consume(record.id, tx),
    );
  };

  login = async ({ email, password }: LoginBody, meta: SessionMeta) => {
    const account = await accountRepository.findByEmail(email);
    const valid = await verifyPassword(password, account?.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (!account || !valid || account.mustSetPassword) {
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

    uploadService.assertUploadedFile(fields.avatarUrl, current.avatarUrl, 'AVATAR', accountId, 'body.avatarUrl');
    if (current.role === 'COACH') {
      uploadService.assertUploadedFile(
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
      await accountRepository.setOwnPassword(account, passwordHash, tx);
      await refreshTokenRepository.revokeAllByAccountId(account.id, tx);
    });
  };

  private verifyOtp = async (email: string, purpose: CodePurpose, code: string) => {
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

  private findActivation = async (token: string) => {
    const [id, secret] = token.split('.');
    if (!id || !secret || !UUID_PATTERN.test(id)) throw invalidActivation();
    const record = await otpRepository.findById(id);
    if (
      !record ||
      record.purpose !== 'ACCOUNT_ACTIVATION' ||
      record.consumedAt ||
      !safeEqual(record.codeHash, hashToken(secret))
    ) {
      throw invalidActivation();
    }
    if (record.expiresAt < new Date()) {
      throw fail(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODE.TOKEN_EXPIRED,
        'Link kích hoạt đã hết hạn, vui lòng đăng nhập bằng email để nhận mã',
      );
    }

    const account = await accountRepository.findByEmail(record.email);
    if (!account || account.status !== 'ACTIVE' || !account.mustSetPassword) throw invalidActivation();
    return { record, account };
  };

  private phoneTaken = () =>
    new ErrorWithStatus({
      status: HTTP_STATUS.CONFLICT,
      code: ERROR_CODE.PHONE_TAKEN,
      message: 'Số điện thoại đã được sử dụng',
      errors: [{ path: 'body.phone', message: 'Số điện thoại đã được sử dụng' }],
    });

  private otpCooldown = async (email: string, purpose: CodePurpose) => {
    const latest = await otpRepository.findLatestActive(email, purpose);
    if (!latest) return 0;
    const elapsed = (Date.now() - latest.createdAt.getTime()) / 1000;
    return elapsed < AUTH.OTP_RESEND_COOLDOWN ? Math.ceil(AUTH.OTP_RESEND_COOLDOWN - elapsed) : 0;
  };

  private issueOtp = async (email: string, purpose: CodePurpose) => {
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

  getGoogleAuthUrl = (state: string, callbackUrl: string) => {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw fail(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODE.INTERNAL,
        'Google OAuth chưa được cấu hình trên server (thiếu GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET)',
      );
    }
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      prompt: 'select_account',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  loginWithGoogle = async (code: string, callbackUrl: string, meta: SessionMeta) => {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw fail(HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODE.INTERNAL, 'Google OAuth chưa được cấu hình trên server');
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Google token exchange failed:', errorText);
      throw fail(HTTP_STATUS.BAD_REQUEST, ERROR_CODE.UNAUTHORIZED, 'Không thể xác thực mã với Google');
    }

    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      throw fail(HTTP_STATUS.BAD_REQUEST, ERROR_CODE.UNAUTHORIZED, 'Không nhận được access token từ Google');
    }

    const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userinfoResponse.ok) {
      throw fail(HTTP_STATUS.BAD_REQUEST, ERROR_CODE.UNAUTHORIZED, 'Không thể lấy thông tin người dùng từ Google');
    }

    const googleUser = (await userinfoResponse.json()) as {
      sub: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };

    if (!googleUser.email || !googleUser.email_verified) {
      throw fail(HTTP_STATUS.FORBIDDEN, ERROR_CODE.FORBIDDEN, 'Email Google chưa được xác thực');
    }

    const email = googleUser.email.toLowerCase().trim();
    let account = await accountRepository.findByEmail(email);

    if (account) {
      if (account.status !== 'ACTIVE') {
        throw fail(HTTP_STATUS.FORBIDDEN, ERROR_CODE.ACCOUNT_INACTIVE, 'Tài khoản đã bị vô hiệu hóa');
      }

      const updates: Prisma.AccountUpdateInput = {};
      if (!account.emailVerifiedAt) updates.emailVerifiedAt = new Date();
      if (!account.avatarUrl && googleUser.picture) updates.avatarUrl = googleUser.picture;

      if (Object.keys(updates).length > 0) {
        account = await prisma.account.update({
          where: { id: account.id },
          data: updates,
          include: accountProfileInclude,
        });
      }

      const tokens = await this.issueTokens(account.id, account.role, meta);
      return { account: toAccountResponse(account), ...tokens };
    }

    // Unguessable placeholder: email login stays closed until the member sets a real password
    const placeholderHash = await hashPassword(generateOpaqueToken());
    return this.createMemberWithSession(
      {
        email,
        fullName: googleUser.name?.trim() || email.split('@')[0] || 'Member',
        avatarUrl: googleUser.picture ?? null,
        passwordHash: placeholderHash,
        emailVerifiedAt: new Date(),
        // First Google sign-in: the web app sends them to set a real password before anything else
        mustSetPassword: true,
      },
      {
        message:
          'Tài khoản của bạn đã được liên kết thành công với Google. Bạn có thể đặt sân, đăng ký lớp học và mua gói thành viên ngay trên hệ thống.',
        sendEmail: false,
      },
      meta,
    );
  };

  /**
   * Creates a member with its first session and welcome notification in one transaction.
   * `before` runs first inside that transaction (e.g. consuming the sign-up OTP).
   */
  private createMemberWithSession = async (
    data: Parameters<typeof accountRepository.createMember>[0],
    welcome: { message: string; sendEmail: boolean },
    meta: SessionMeta,
    before?: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ) => {
    const refreshToken = generateOpaqueToken();

    const { account, notifications } = await prisma.$transaction(async (tx) => {
      await before?.(tx);
      const created = await accountRepository.createMember(data, tx);
      await refreshTokenRepository.create(this.refreshTokenData(refreshToken, created.id, meta), tx);
      const notifications = await notificationService.create(
        [
          {
            accountId: created.id,
            type: 'SYSTEM',
            title: 'Chào mừng bạn đến với Sports Center',
            message: welcome.message,
            dedupKey: `welcome:${created.id}`,
            sendEmail: welcome.sendEmail,
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
