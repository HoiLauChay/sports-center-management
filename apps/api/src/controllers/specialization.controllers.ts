import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import specializationService from '~/services/specialization.service';

class SpecializationController {
  listForCoach = async (req: Request, res: Response) => {
    const specializations = await specializationService.listForCoach(req.user!.id);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: specializations }));
  };

  listForManager = async (_req: Request, res: Response) => {
    const specializations = await specializationService.listForManager();
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: specializations }));
  };
}

export default new SpecializationController();
