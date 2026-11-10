import { userIdParamsSchema } from '@sports-center/shared';
import { Router } from 'express';

import coachController from '~/controllers/coach.controllers';
import { auth } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const coachRouter = Router();

coachRouter.use(auth);
coachRouter.get('/:id', validate({ params: userIdParamsSchema }), coachController.getProfile);

export default coachRouter;
