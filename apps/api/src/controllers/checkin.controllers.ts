import type { ListCheckInsQuery, ListMyCheckInsQuery } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import checkinService from '~/services/checkin.service';

class CheckinController {
  create = async (req: Request, res: Response) => {
    const result = await checkinService.create(req.user!.id, req.body);
    res.status(HTTP_STATUS.CREATED).json(new ResponseClient({ message: 'Đã check-in', result }));
  };

  list = async (req: Request, res: Response) => {
    const result = await checkinService.list(req.query as unknown as ListCheckInsQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  listMine = async (req: Request, res: Response) => {
    const result = await checkinService.listMine(req.user!.id, req.query as unknown as ListMyCheckInsQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };
}

export default new CheckinController();
