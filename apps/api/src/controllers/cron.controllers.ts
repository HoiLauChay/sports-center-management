import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import cleanupService from '~/services/cleanup.service';

class CronController {
  cleanup = async (_req: Request, res: Response) => {
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ result: await cleanupService.run() }));
  };
}

export default new CronController();
