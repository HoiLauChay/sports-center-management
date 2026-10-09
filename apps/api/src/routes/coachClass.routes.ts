import { Router } from 'express';

import classController from '~/controllers/class.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';

const coachClassRouter = Router();

coachClassRouter.use(auth, isRole('COACH'));
coachClassRouter.get('/', classController.listForCoach);

export default coachClassRouter;
