import type { ListClassesQuery } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import classService from '~/services/class.service';
import { getClientIp } from '~/utils/request';

class ClassController {
  list = async (req: Request, res: Response) => {
    const result = await classService.list(req.user!, req.query as unknown as ListClassesQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  get = async (req: Request, res: Response) => {
    const result = await classService.get(req.user!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  update = async (req: Request, res: Response) => {
    const result = await classService.update(req.user!.id, req.params.id as string, req.body, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã cập nhật lớp học', result }));
  };

  approve = async (req: Request, res: Response) => {
    const result = await classService.approve(req.user!.id, req.params.id as string, req.body, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã duyệt lớp học', result }));
  };

  reject = async (req: Request, res: Response) => {
    const result = await classService.reject(req.user!.id, req.params.id as string, req.body, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã từ chối lớp học', result }));
  };

  create = async (req: Request, res: Response) => {
    const result = await classService.create(req.user!.id, req.body, getClientIp(req));
    res.status(HTTP_STATUS.CREATED).json(new ResponseClient({ message: 'Đã tạo lớp học', result }));
  };
}

export default new ClassController();
