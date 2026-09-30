import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import specializationService from '~/services/specialization.service';
import { getClientIp } from '~/utils/request';

class SpecializationController {
  listForCoach = async (req: Request, res: Response) => {
    const specializations = await specializationService.listForCoach(req.user!.id);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: specializations }));
  };

  register = async (req: Request, res: Response) => {
    const specialization = await specializationService.register(req.user!.id, req.body.sportId, getClientIp(req));
    res
      .status(HTTP_STATUS.CREATED)
      .json(new ResponseClient({ message: 'Đã đăng ký chuyên môn', result: specialization }));
  };

  listForManager = async (_req: Request, res: Response) => {
    const specializations = await specializationService.listForManager();
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: specializations }));
  };
}

export default new SpecializationController();
