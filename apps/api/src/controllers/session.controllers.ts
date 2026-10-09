import type { ListSessionsQuery } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import sessionService from '~/services/session.service';
import { getClientIp } from '~/utils/request';

class SessionController {
  list = async (req: Request, res: Response) => {
    const result = await sessionService.listOn(req.query as unknown as ListSessionsQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  get = async (req: Request, res: Response) => {
    const result = await sessionService.get(req.user!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  update = async (req: Request, res: Response) => {
    const result = await sessionService.update(req.user!.id, req.params.id as string, req.body, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã cập nhật buổi học', result }));
  };
}

export default new SessionController();
