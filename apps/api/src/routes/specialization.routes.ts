import { Router } from 'express';

import specializationController from '~/controllers/specialization.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';

export const coachSpecializationRouter = Router();
coachSpecializationRouter.use(auth, isRole('COACH'));
coachSpecializationRouter.get('/', specializationController.listForCoach);

export const managerSpecializationRouter = Router();
managerSpecializationRouter.use(auth, isRole('MANAGER'));
managerSpecializationRouter.get('/', specializationController.listForManager);
