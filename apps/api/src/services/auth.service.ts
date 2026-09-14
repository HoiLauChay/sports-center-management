import { prisma } from '~/configs/db';
import { AUTH } from '~/constants/auth';
import { ERROR_CODE, type ErrorCode } from '~/constants/errorCode';
import { HTTP_STATUS } from '~/constants/httpStatus';
import type { OtpPurpose } from '~/generated/prisma/client';
import otpRepository from '~/repositories/otp.repository';
import refreshTokenRepository from '~/repositories/refreshToken.repository';
import userRepository from '~/repositories/user.repository';
import { ErrorWithStatus } from '~/rules/error';
import type { RegisterBody, SendOtpBody } from '~/schemas/auth.schema';
import mailService from '~/services/mail.service';
import { verifyCaptcha } from '~/utils/captcha';
import { signAccessToken } from '~/utils/jwt';
import { hashPassword } from '~/utils/password';
import { generateOpaqueToken, generateOtp, hashToken, safeEqual } from '~/utils/token';

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

const fail = (status: number, code: ErrorCode, message: string) => new ErrorWithStatus({ status, code, message });

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

  private refreshTokenData = (rawToken: string, userId: string, meta: SessionMeta) => ({
    tokenHash: hashToken(rawToken),
    userId,
    expiresAt: new Date(Date.now() + AUTH.REFRESH_TOKEN_TTL * 1000),
    ...meta,
  });
}

export default new AuthService();
