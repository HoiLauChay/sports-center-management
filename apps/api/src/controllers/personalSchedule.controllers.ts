import type { PersonalScheduleQuery } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import personalScheduleService from '~/services/personalSchedule.service';

class PersonalScheduleController {
  member = async (req: Request, res: Response) => {
    const result = await personalScheduleService.member(req.user!.id, req.query as unknown as PersonalScheduleQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };

  coach = async (req: Request, res: Response) => {
    const result = await personalScheduleService.coach(req.user!.id, req.query as unknown as PersonalScheduleQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result }));
  };
}

export default new PersonalScheduleController();
