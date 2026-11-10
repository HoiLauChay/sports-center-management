import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import coachService from '~/services/coach.service';

class CoachController {
  getProfile = async (req: Request, res: Response) => {
    const profile = await coachService.getPublicProfile(req.params.id as string);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: profile }));
  };
}

export default new CoachController();
