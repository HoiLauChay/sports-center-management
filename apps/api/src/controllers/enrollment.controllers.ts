import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import enrollmentService from '~/services/enrollment.service';

class EnrollmentController {
  listMine = async (req: Request, res: Response) => {
    const result = await enrollmentService.listMine(req.user!.id);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  listForClass = async (req: Request, res: Response) => {
    const result = await enrollmentService.listForClass(req.user!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  cancel = async (req: Request, res: Response) => {
    const result = await enrollmentService.cancel(req.user!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã hủy đăng ký lớp', result }));
  };
}

export default new EnrollmentController();
