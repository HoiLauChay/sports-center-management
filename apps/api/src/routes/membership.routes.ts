import { createMembershipBodySchema, membershipIdParamsSchema, updateMembershipBodySchema } from '@sports-center/shared';
import { Router } from 'express';

import membershipController from '~/controllers/membership.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const membershipRouter = Router();

membershipRouter.use(auth);
membershipRouter.get('/', membershipController.list);
membershipRouter.post('/', isRole('MANAGER'), validate({ body: createMembershipBodySchema }), membershipController.create);
membershipRouter.patch(
  '/:id',
  isRole('MANAGER'),
  validate({ params: membershipIdParamsSchema, body: updateMembershipBodySchema }),
  membershipController.update,
);

export default membershipRouter;
