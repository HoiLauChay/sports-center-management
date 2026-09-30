import {
  createSpecializationBodySchema,
  reviewSpecializationBodySchema,
  specializationIdParamsSchema,
} from '@sports-center/shared';
import { Router } from 'express';

import specializationController from '~/controllers/specialization.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

export const coachSpecializationRouter = Router();
coachSpecializationRouter.use(auth, isRole('COACH'));
coachSpecializationRouter.get('/', specializationController.listForCoach);
coachSpecializationRouter.post(
  '/',
  validate({ body: createSpecializationBodySchema }),
  specializationController.register,
);

export const managerSpecializationRouter = Router();
managerSpecializationRouter.use(auth, isRole('MANAGER'));
managerSpecializationRouter.get('/', specializationController.listForManager);
managerSpecializationRouter.post(
  '/:id/approve',
  validate({ params: specializationIdParamsSchema, body: reviewSpecializationBodySchema }),
  specializationController.approve,
);
managerSpecializationRouter.post(
  '/:id/reject',
  validate({ params: specializationIdParamsSchema, body: reviewSpecializationBodySchema }),
  specializationController.reject,
);
