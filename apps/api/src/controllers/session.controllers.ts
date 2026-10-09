import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import sessionService from '~/services/session.service';
import { getClientIp } from '~/utils/request';

class SessionController {
  update = async (req: Request, res: Response) => {
    const result = await sessionService.update(req.user!.id, req.params.id as string, req.body, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã cập nhật buổi học', result }));
  };
}

export default new SessionController();
