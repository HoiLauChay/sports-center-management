import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import classService from '~/services/class.service';
import { getClientIp } from '~/utils/request';

class ClassController {
  create = async (req: Request, res: Response) => {
    const result = await classService.create(req.user!.id, req.body, getClientIp(req));
    res.status(HTTP_STATUS.CREATED).json(new ResponseClient({ message: 'Đã tạo lớp học', result }));
  };
}

export default new ClassController();
