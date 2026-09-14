import bcrypt from 'bcryptjs';

import { prisma } from '~/configs/db';
import { AUTH } from '~/constants/auth';
import { ERROR_CODE, type ErrorCode } from '~/constants/errorCode';
import { HTTP_STATUS } from '~/constants/httpStatus';
import type { OtpPurpose, Role, User } from '~/generated/prisma/client';
import otpRepository from '~/repositories/otp.repository';
import refreshTokenRepository from '~/repositories/refreshToken.repository';
import userRepository, { type PublicUser } from '~/repositories/user.repository';
import { ErrorWithStatus } from '~/rules/error';
import type { LoginBody, RegisterBody, SendOtpBody } from '~/schemas/auth.schema';
import mailService from '~/services/mail.service';
import { verifyCaptcha } from '~/utils/captcha';
import { signAccessToken } from '~/utils/jwt';
import { hashPassword, verifyPassword } from '~/utils/password';
import { generateOpaqueToken, generateOtp, hashToken, safeEqual } from '~/utils/token';

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy-password', AUTH.BCRYPT_ROUNDS);

const fail = (status: number, code: ErrorCode, message: string) => new ErrorWithStatus({ status, code, message });

const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  email: user.email,
  role: user.role,
  status: user.status,
  emailVerifiedAt: user.emailVerifiedAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

class AuthService {
  sendOtp = async ({ email, purpose, captchaToken }: SendOtpBody, ip?: string) => {
    if (!(await verifyCaptcha(captchaToken, ip))) {
      throw fail(HTTP_STATUS.BAD_REQUEST, ERROR_CODE.CAPTCHA_FAILED, 'Xác thực captcha thất bại!');
    }

    const exists = await userRepository.existsByEmail(email);
    if (purpose === 'REGISTER' && exists) {
      throw fail(HTTP_STATUS.CONFLICT, ERROR_CODE.EMAIL_TAKEN, 'Email đã được đăng ký!');
    }
    if (purpose === 'PASSWORD_RESET' && !exists) return;

    const latest = await otpRepository.findLatestActive(email, purpose);
    if (latest) {
      const elapsed = (Date.now() - latest.createdAt.getTime()) / 1000;
      if (elapsed < AUTH.OTP_RESEND_COOLDOWN) {
        const wait = Math.ceil(AUTH.OTP_RESEND_COOLDOWN - elapsed);
        throw fail(HTTP_STATUS.TOO_MANY_REQUESTS, ERROR_CODE.OTP_COOLDOWN, `Vui lòng đợi ${wait} giây để gửi lại mã!`);
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

  register = async ({ email, otp, password }: RegisterBody, meta: SessionMeta) => {
    const record = await this.verifyOtp(email, 'REGISTER', otp);

    if (await userRepository.existsByEmail(email)) {
      throw fail(HTTP_STATUS.CONFLICT, ERROR_CODE.EMAIL_TAKEN, 'Email đã được đăng ký!');
    }

    const passwordHash = await hashPassword(password);
    const refreshToken = generateOpaqueToken();

    const user = await prisma.$transaction(async (tx) => {
      await otpRepository.consume(record.id, tx);
      const created = await userRepository.create({ email, passwordHash, emailVerifiedAt: new Date() }, tx);
      await refreshTokenRepository.create(this.refreshTokenData(refreshToken, created.id, meta), tx);
      return created;
    });

    return { user, accessToken: signAccessToken(user.id, user.role), refreshToken };
  };

  login = async ({ email, password }: LoginBody, meta: SessionMeta) => {
    const user = await userRepository.findByEmail(email);
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (!user || !user.passwordHash || !valid) {
      throw fail(HTTP_STATUS.UNAUTHORIZED, ERROR_CODE.INVALID_CREDENTIALS, 'Email hoặc mật khẩu không đúng!');
    }
    if (user.status !== 'ACTIVE') {
      throw fail(HTTP_STATUS.FORBIDDEN, ERROR_CODE.ACCOUNT_INACTIVE, 'Tài khoản đã bị vô hiệu hóa!');
    }

    const tokens = await this.issueTokens(user.id, user.role, meta);
    return { user: toPublicUser(user), ...tokens };
  };

  refresh = async (rawToken: unknown, meta: SessionMeta) => {
    if (typeof rawToken !== 'string' || !rawToken) {
      throw fail(HTTP_STATUS.UNAUTHORIZED, ERROR_CODE.UNAUTHORIZED, 'Refresh token không được cung cấp!');
    }

    const tokenHash = hashToken(rawToken);
    const record = await refreshTokenRepository.findByHash(tokenHash);

    if (!record) {
      throw fail(HTTP_STATUS.UNAUTHORIZED, ERROR_CODE.TOKEN_INVALID, 'Refresh token không hợp lệ!');
    }
    if (record.revokedAt) {
      await refreshTokenRepository.revokeAllByUserId(record.userId);
      throw fail(HTTP_STATUS.UNAUTHORIZED, ERROR_CODE.TOKEN_INVALID, 'Refresh token không hợp lệ!');
    }
    if (record.expiresAt < new Date()) {
      throw fail(HTTP_STATUS.UNAUTHORIZED, ERROR_CODE.TOKEN_EXPIRED, 'Refresh token đã hết hạn!');
    }
    if (record.user.status !== 'ACTIVE') {
      throw fail(HTTP_STATUS.FORBIDDEN, ERROR_CODE.ACCOUNT_INACTIVE, 'Tài khoản đã bị vô hiệu hóa!');
    }

    const refreshToken = generateOpaqueToken();
    await prisma.$transaction(async (tx) => {
      await refreshTokenRepository.revokeByHash(tokenHash, tx);
      await refreshTokenRepository.create(this.refreshTokenData(refreshToken, record.userId, meta), tx);
    });

    return { accessToken: signAccessToken(record.userId, record.user.role), refreshToken };
  };

  logout = async (rawToken: unknown) => {
    if (typeof rawToken === 'string' && rawToken) {
      await refreshTokenRepository.revokeByHash(hashToken(rawToken));
    }
  };

  logoutAll = (userId: string) => refreshTokenRepository.revokeAllByUserId(userId);

  getMe = async (userId: string) => {
    const user = await userRepository.findById(userId);
    if (!user) throw fail(HTTP_STATUS.NOT_FOUND, ERROR_CODE.NOT_FOUND, 'Người dùng không tồn tại!');
    return user;
  };

  private verifyOtp = async (email: string, purpose: OtpPurpose, code: string) => {
    const record = await otpRepository.findLatestActive(email, purpose);

    if (!record) throw fail(HTTP_STATUS.BAD_REQUEST, ERROR_CODE.OTP_INVALID, 'Mã xác nhận không đúng!');
    if (record.expiresAt < new Date()) {
      throw fail(HTTP_STATUS.BAD_REQUEST, ERROR_CODE.OTP_EXPIRED, 'Mã xác nhận đã hết hạn!');
    }
    if (record.attempts >= AUTH.OTP_MAX_ATTEMPTS) {
      throw fail(
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODE.OTP_MAX_ATTEMPTS,
        'Bạn đã nhập sai quá nhiều lần, vui lòng gửi lại mã!',
      );
    }
    if (!safeEqual(record.codeHash, hashToken(code))) {
      await otpRepository.incrementAttempts(record.id);
      throw fail(HTTP_STATUS.BAD_REQUEST, ERROR_CODE.OTP_INVALID, 'Mã xác nhận không đúng!');
    }

    return record;
  };

  private issueTokens = async (userId: string, role: Role, meta: SessionMeta) => {
    const refreshToken = generateOpaqueToken();
    await refreshTokenRepository.create(this.refreshTokenData(refreshToken, userId, meta));
    return { accessToken: signAccessToken(userId, role), refreshToken };
  };

  private refreshTokenData = (rawToken: string, userId: string, meta: SessionMeta) => ({
    tokenHash: hashToken(rawToken),
    userId,
    expiresAt: new Date(Date.now() + AUTH.REFRESH_TOKEN_TTL * 1000),
    ...meta,
  });
}

export default new AuthService();
