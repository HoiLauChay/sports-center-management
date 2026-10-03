import { createClassBodySchema } from '@sports-center/shared';
import { Router } from 'express';

import classController from '~/controllers/class.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const classRouter = Router();

classRouter.use(auth);
classRouter.post('/', isRole('MANAGER'), validate({ body: createClassBodySchema }), classController.create);

export default classRouter;
