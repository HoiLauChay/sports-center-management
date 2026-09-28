import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import sportService from '~/services/sport.service';
import { getClientIp } from '~/utils/request';

class SportController {
  list = async (req: Request, res: Response) => {
    const isManager = req.user?.role === 'MANAGER';
    const sports = await sportService.list(isManager);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: sports }));
  };

  create = async (req: Request, res: Response) => {
    const sport = await sportService.create(req.user!.id, req.body, getClientIp(req));
    res.status(HTTP_STATUS.CREATED).json(new ResponseClient({ message: 'Đã tạo bộ môn', result: sport }));
  };

  update = async (req: Request, res: Response) => {
    const sport = await sportService.update(req.user!.id, req.params.id as string, req.body, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Cập nhật bộ môn thành công', result: sport }));
  };

  remove = async (req: Request, res: Response) => {
    await sportService.remove(req.user!.id, req.params.id as string, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã xóa bộ môn' }));
  };
}

export default new SportController();
