import type { Request, Response } from 'express';

import { COOKIE } from '~/constants/auth';
import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import authService, { type SessionMeta } from '~/services/auth.service';
import { clearAuthCookies, setAuthCookies } from '~/utils/cookie';
import { getClientIp } from '~/utils/request';

const sessionMeta = (req: Request): SessionMeta => ({
  userAgent: req.get('user-agent'),
  ip: getClientIp(req),
});

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
}

export default new AuthController();
