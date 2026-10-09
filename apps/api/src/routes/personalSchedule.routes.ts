import { personalScheduleQuerySchema } from '@sports-center/shared';
import { Router } from 'express';

import personalScheduleController from '~/controllers/personalSchedule.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

export const memberScheduleRouter = Router();
memberScheduleRouter.get(
  '/',
  auth,
  isRole('MEMBER'),
  validate({ query: personalScheduleQuerySchema }),
  personalScheduleController.member,
);

export const coachScheduleRouter = Router();
coachScheduleRouter.get(
  '/',
  auth,
  isRole('COACH'),
  validate({ query: personalScheduleQuerySchema }),
  personalScheduleController.coach,
);
