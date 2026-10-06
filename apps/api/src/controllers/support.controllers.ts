import type { ListSupportQuery } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import supportService from '~/services/support.service';

class SupportController {
  create = async (req: Request, res: Response) => {
    const result = await supportService.create(req.user!.id, req.body);
    res.status(HTTP_STATUS.CREATED).json(new ResponseClient({ message: 'Đã tạo yêu cầu hỗ trợ', result }));
  };

  listMine = async (req: Request, res: Response) => {
    const result = await supportService.listMine(req.user!.id);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  list = async (req: Request, res: Response) => {
    const result = await supportService.list(req.query as unknown as ListSupportQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  get = async (req: Request, res: Response) => {
    const result = await supportService.get(req.user!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  update = async (req: Request, res: Response) => {
    const result = await supportService.update(req.user!.id, req.params.id as string, req.body);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã cập nhật yêu cầu hỗ trợ', result }));
  };
}

export default new SupportController();
