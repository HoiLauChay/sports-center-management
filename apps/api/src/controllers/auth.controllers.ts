import type { Request, Response } from 'express';

import { appUrl, env } from '~/configs/env';
import { COOKIE } from '~/constants/auth';
import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import authService, { type SessionMeta } from '~/services/auth.service';
import { clearAuthCookies, clearOAuthStateCookie, setAuthCookies, setOAuthStateCookie } from '~/utils/cookie';
import { getClientIp } from '~/utils/request';
import { generateOpaqueToken } from '~/utils/token';

const sessionMeta = (req: Request): SessionMeta => ({
  userAgent: req.get('user-agent'),
  ip: getClientIp(req),
});

const getGoogleCallbackUrl = (req?: Request) => {
  if (env.GOOGLE_CALLBACK_URL) return env.GOOGLE_CALLBACK_URL;
  if (req) {
    const forwardedHost = req.get('x-forwarded-host') || req.get('host');
    const forwardedProto = req.get('x-forwarded-proto') || req.protocol;
    if (forwardedHost) {
      return `${forwardedProto}://${forwardedHost}/api/v1/auth/google/callback`;
    }
  }
  return `${appUrl}/api/v1/auth/google/callback`;
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

  googleAuth = async (req: Request, res: Response) => {
    const rawRedirect = req.query.redirect;
    const redirectPath =
      typeof rawRedirect === 'string' && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
        ? rawRedirect
        : '/';

    const nonce = generateOpaqueToken();
    const state = Buffer.from(JSON.stringify({ nonce, redirect: redirectPath })).toString('base64url');
    setOAuthStateCookie(res, state);

    const callbackUrl = getGoogleCallbackUrl(req);
    try {
      const authUrl = authService.getGoogleAuthUrl(state, callbackUrl);
      res.redirect(authUrl);
    } catch (err) {
      clearOAuthStateCookie(res);
      const msg = err instanceof Error ? err.message : 'Google OAuth chưa được cấu hình';
      res.redirect(`${appUrl}/login?error=${encodeURIComponent(msg)}`);
    }
  };

  googleCallback = async (req: Request, res: Response) => {
    const error = req.query.error as string | undefined;
    if (error) {
      clearOAuthStateCookie(res);
      return res.redirect(`${appUrl}/login?error=${encodeURIComponent(error)}`);
    }

    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const cookieState = req.cookies.oauth_state as string | undefined;

    if (!code || !state || !cookieState || state !== cookieState) {
      clearOAuthStateCookie(res);
      return res.redirect(
        `${appUrl}/login?error=${encodeURIComponent('Xác thực trạng thái OAuth thất bại (CSRF check)')}`,
      );
    }

    let targetRedirect = '/';
    try {
      const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
      if (typeof parsed.redirect === 'string' && parsed.redirect.startsWith('/') && !parsed.redirect.startsWith('//')) {
        targetRedirect = parsed.redirect;
      }
    } catch {
      targetRedirect = '/';
    }

    const callbackUrl = getGoogleCallbackUrl(req);

    try {
      const { accessToken, refreshToken } = await authService.loginWithGoogle(code, callbackUrl, sessionMeta(req));
      setAuthCookies(res, accessToken, refreshToken);
      clearOAuthStateCookie(res);
      return res.redirect(`${appUrl}${targetRedirect}`);
    } catch (err) {
      clearOAuthStateCookie(res);
      const message = err instanceof Error ? err.message : 'Đăng nhập Google thất bại';
      return res.redirect(`${appUrl}/login?error=${encodeURIComponent(message)}`);
    }
  };
}

export default new AuthController();
