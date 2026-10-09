import { enrollmentIdParamsSchema } from '@sports-center/shared';
import { Router } from 'express';

import enrollmentController from '~/controllers/enrollment.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

export const myEnrollmentRouter = Router();
myEnrollmentRouter.use(auth, isRole('MEMBER'));
myEnrollmentRouter.get('/', enrollmentController.listMine);

export const enrollmentRouter = Router();
enrollmentRouter.use(auth, isRole('MEMBER', 'RECEPTIONIST'));
enrollmentRouter.post('/:id/cancel', validate({ params: enrollmentIdParamsSchema }), enrollmentController.cancel);
