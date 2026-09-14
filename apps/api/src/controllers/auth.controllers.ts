import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import authService, { type SessionMeta } from '~/services/auth.service';
import { setAuthCookies } from '~/utils/cookie';

const sessionMeta = (req: Request): SessionMeta => ({
  userAgent: req.get('user-agent'),
  ip: req.ip,
});

class AuthController {
  sendOtp = async (req: Request, res: Response) => {
    await authService.sendOtp(req.body, req.ip);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Nếu email hợp lệ, mã xác nhận đã được gửi!' }));
  };

  register = async (req: Request, res: Response) => {
    const { user, accessToken, refreshToken } = await authService.register(req.body, sessionMeta(req));
    setAuthCookies(res, accessToken, refreshToken);
    res.status(HTTP_STATUS.CREATED).json(new ResponseClient({ message: 'Đăng ký thành công!', result: user }));
  };
}

export default new AuthController();
