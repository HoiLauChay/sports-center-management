import { createMembershipBodySchema } from '@sports-center/shared';
import { Router } from 'express';

import membershipController from '~/controllers/membership.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const membershipRouter = Router();

membershipRouter.use(auth);
membershipRouter.get('/', membershipController.list);
membershipRouter.post('/', isRole('MANAGER'), validate({ body: createMembershipBodySchema }), membershipController.create);

export default membershipRouter;
