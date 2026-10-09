import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import attendanceJobService from '~/services/attendanceJob.service';
import bankTransactionService from '~/services/bankTransaction.service';
import classJobService from '~/services/classJob.service';
import cleanupService from '~/services/cleanup.service';
import membershipJobService from '~/services/membershipJob.service';
import reminderJobService from '~/services/reminderJob.service';

class CronController {
  attendanceDefaults = async (_req: Request, res: Response) => {
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ result: await attendanceJobService.run() }));
  };

  classMinStudents = async (_req: Request, res: Response) => {
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ result: await classJobService.cancelUnderfilled() }));
  };

  cleanup = async (_req: Request, res: Response) => {
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ result: await cleanupService.run() }));
  };

  memberships = async (_req: Request, res: Response) => {
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ result: await membershipJobService.run() }));
  };

  reminders = async (_req: Request, res: Response) => {
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ result: await reminderJobService.run() }));
  };

  sepaySync = async (_req: Request, res: Response) => {
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ result: await bankTransactionService.syncFromSepay() }));
  };
}

export default new CronController();
