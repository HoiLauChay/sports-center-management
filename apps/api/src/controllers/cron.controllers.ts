import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import attendanceJobService from '~/services/attendanceJob.service';
import bankTransactionService from '~/services/bankTransaction.service';
import cleanupService from '~/services/cleanup.service';
import membershipJobService from '~/services/membershipJob.service';

class CronController {
  attendanceDefaults = async (_req: Request, res: Response) => {
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ result: await attendanceJobService.run() }));
  };

  cleanup = async (_req: Request, res: Response) => {
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ result: await cleanupService.run() }));
  };

  memberships = async (_req: Request, res: Response) => {
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ result: await membershipJobService.run() }));
  };

  sepaySync = async (_req: Request, res: Response) => {
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ result: await bankTransactionService.syncFromSepay() }));
  };
}

export default new CronController();
