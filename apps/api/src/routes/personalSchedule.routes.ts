import { personalScheduleQuerySchema } from '@sports-center/shared';
import { Router } from 'express';

import personalScheduleController from '~/controllers/personalSchedule.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

export const memberScheduleRouter = Router();
memberScheduleRouter.use(auth, isRole('MEMBER'));
memberScheduleRouter.get('/', validate({ query: personalScheduleQuerySchema }), personalScheduleController.member);

export const coachScheduleRouter = Router();
coachScheduleRouter.use(auth, isRole('COACH'));
coachScheduleRouter.get('/', validate({ query: personalScheduleQuerySchema }), personalScheduleController.coach);
