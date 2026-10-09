import { sessionIdParamsSchema, updateSessionBodySchema } from '@sports-center/shared';
import { Router } from 'express';

import sessionController from '~/controllers/session.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const sessionRouter = Router();
sessionRouter.use(auth);
sessionRouter.patch(
  '/:id',
  isRole('MANAGER'),
  validate({ params: sessionIdParamsSchema, body: updateSessionBodySchema }),
  sessionController.update,
);

export default sessionRouter;
