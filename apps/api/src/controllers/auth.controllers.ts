import { ERROR_CODE, type GoogleLoginErrorCode } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { appUrl, env } from '~/configs/env';
import { COOKIE } from '~/constants/auth';
import { HTTP_STATUS } from '~/constants/httpStatus';
import { ErrorWithStatus } from '~/rules/error';
import { ResponseClient } from '~/rules/response';
import authService, { type SessionMeta } from '~/services/auth.service';
import { clearAuthCookies, clearOAuthStateCookie, setAuthCookies, setOAuthStateCookie } from '~/utils/cookie';
import { getClientIp } from '~/utils/request';
import { generateOpaqueToken } from '~/utils/token';

const sessionMeta = (req: Request): SessionMeta => ({
  userAgent: req.get('user-agent'),
  ip: getClientIp(req),
});

const googleCallbackUrl = env.GOOGLE_CALLBACK_URL ?? `${appUrl}/api/v1/auth/google/callback`;

const DEFAULT_AFTER_LOGIN = '/dashboard';

const safeRedirectPath = (value: unknown) =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
    ? value
    : DEFAULT_AFTER_LOGIN;

const landingPath = (state: string) => {
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as { redirect?: unknown };
    return safeRedirectPath(parsed.redirect);
  } catch {
    return DEFAULT_AFTER_LOGIN;
  }
};

const toLoginWithError = (res: Response, code: GoogleLoginErrorCode) => {
  clearOAuthStateCookie(res);
  res.redirect(`${appUrl}/login?error=${code}`);
};

const googleErrorCode = (err: unknown): GoogleLoginErrorCode => {
  if (err instanceof ErrorWithStatus) {
    if (err.code === ERROR_CODE.ACCOUNT_INACTIVE) return 'ACCOUNT_INACTIVE';
    if (err.code === ERROR_CODE.FORBIDDEN) return 'EMAIL_UNVERIFIED';
    if (err.code === ERROR_CODE.INTERNAL) return 'NOT_CONFIGURED';
    return 'FAILED';
  }
  console.error('Google sign-in failed:', err);
  return 'FAILED';
};

class AuthController {
  sendOtp = async (req: Request, res: Response) => {
    await authService.sendOtp(req.body, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: `Đã gửi mã xác nhận đến ${req.body.email}` }));
  };

  register = async (req: Request, res: Response) => {
    const { account, accessToken, refreshToken } = await authService.register(req.body, sessionMeta(req));
    setAuthCookies(res, accessToken, refreshToken);
    res.status(HTTP_STATUS.CREATED).json(new ResponseClient({ message: 'Đăng ký thành công', result: account }));
  };

  login = async (req: Request, res: Response) => {
    const { account, accessToken, refreshToken } = await authService.login(req.body, sessionMeta(req));
    setAuthCookies(res, accessToken, refreshToken);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đăng nhập thành công', result: account }));
  };

  loginStart = async (req: Request, res: Response) => {
    const result = await authService.loginStart(req.body);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  verifyOtp = async (req: Request, res: Response) => {
    await authService.checkOtp(req.body);
    res.status(HTTP_STATUS.NO_CONTENT).send();
  };

  setPassword = async (req: Request, res: Response) => {
    const { account, accessToken, refreshToken } = await authService.setPassword(req.body, sessionMeta(req));
    setAuthCookies(res, accessToken, refreshToken);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đặt mật khẩu thành công', result: account }));
  };

  setFirstPassword = async (req: Request, res: Response) => {
    const { account, accessToken, refreshToken } = await authService.setFirstPassword(
      req.user!.id,
      req.body,
      sessionMeta(req),
    );
    setAuthCookies(res, accessToken, refreshToken);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đặt mật khẩu thành công', result: account }));
  };

  checkActivation = async (req: Request, res: Response) => {
    const result = await authService.checkActivation(req.body);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  activate = async (req: Request, res: Response) => {
    const { account, accessToken, refreshToken } = await authService.activate(req.body, sessionMeta(req));
    setAuthCookies(res, accessToken, refreshToken);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Kích hoạt tài khoản thành công', result: account }));
  };

  refresh = async (req: Request, res: Response) => {
    try {
      const { accessToken, refreshToken } = await authService.refresh(
        req.cookies?.[COOKIE.REFRESH_TOKEN],
        sessionMeta(req),
      );
      setAuthCookies(res, accessToken, refreshToken);
      res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Làm mới phiên đăng nhập thành công' }));
    } catch (err) {
      clearAuthCookies(res);
      throw err;
    }
  };

  logout = async (req: Request, res: Response) => {
    await authService.logout(req.cookies?.[COOKIE.REFRESH_TOKEN]);
    clearAuthCookies(res);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đăng xuất thành công' }));
  };

  logoutAll = async (req: Request, res: Response) => {
    await authService.logoutAll(req.user!.id);
    clearAuthCookies(res);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã đăng xuất khỏi tất cả thiết bị' }));
  };

  getMe = async (req: Request, res: Response) => {
    const account = await authService.getMe(req.user!.id);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: account }));
  };

  updateNotificationSettings = async (req: Request, res: Response) => {
    const account = await authService.updateNotificationSettings(req.user!.id, req.body);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã lưu cài đặt thông báo', result: account }));
  };

  switchRole = async (req: Request, res: Response) => {
    const account = await authService.switchRole(req.user!.id, req.body.role);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã chuyển vai trò', result: account }));
  };

  updateMe = async (req: Request, res: Response) => {
    const account = await authService.updateMe(req.user!.id, req.body, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Cập nhật hồ sơ thành công', result: account }));
  };

  changePassword = async (req: Request, res: Response) => {
    await authService.changePassword(req.user!.id, req.body);
    clearAuthCookies(res);
    res
      .status(HTTP_STATUS.OK)
      .json(new ResponseClient({ message: 'Đổi mật khẩu thành công! Vui lòng đăng nhập lại.' }));
  };

  resetPassword = async (req: Request, res: Response) => {
    await authService.resetPassword(req.body);
    res
      .status(HTTP_STATUS.OK)
      .json(new ResponseClient({ message: 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.' }));
  };

  googleAuth = (req: Request, res: Response) => {
    const nonce = generateOpaqueToken();
    const state = Buffer.from(JSON.stringify({ nonce, redirect: safeRedirectPath(req.query.redirect) })).toString(
      'base64url',
    );

    try {
      const authUrl = authService.getGoogleAuthUrl(state, googleCallbackUrl);
      setOAuthStateCookie(res, state);
      res.redirect(authUrl);
    } catch (err) {
      toLoginWithError(res, googleErrorCode(err));
    }
  };

  googleCallback = async (req: Request, res: Response) => {
    if (req.query.error) {
      return toLoginWithError(res, req.query.error === 'access_denied' ? 'CANCELLED' : 'FAILED');
    }

    const code = req.query.code;
    const state = req.query.state;
    const cookieState: unknown = req.cookies[COOKIE.OAUTH_STATE];
    if (typeof code !== 'string' || typeof state !== 'string' || !code || state !== cookieState) {
      return toLoginWithError(res, 'STATE_MISMATCH');
    }

    const redirect = landingPath(state);

    try {
      const { accessToken, refreshToken } = await authService.loginWithGoogle(
        code,
        googleCallbackUrl,
        sessionMeta(req),
      );
      setAuthCookies(res, accessToken, refreshToken);
      clearOAuthStateCookie(res);
      return res.redirect(`${appUrl}${redirect}`);
    } catch (err) {
      return toLoginWithError(res, googleErrorCode(err));
    }
  };
}

export default new AuthController();
