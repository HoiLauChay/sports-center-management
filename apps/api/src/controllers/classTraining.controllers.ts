import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import classTrainingService from '~/services/classTraining.service';

class ClassTrainingController {
  roster = async (req: Request, res: Response) => {
    const result = await classTrainingService.roster(req.user!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  student = async (req: Request, res: Response) => {
    const result = await classTrainingService.student(
      req.user!,
      req.params.id as string,
      req.params.accountId as string,
    );
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };
}

export default new ClassTrainingController();
