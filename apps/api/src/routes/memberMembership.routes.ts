import { autoRenewBodySchema, membershipIdParamsSchema } from '@sports-center/shared';
import { Router } from 'express';

import memberMembershipController from '~/controllers/memberMembership.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

export const myMembershipRouter = Router();
myMembershipRouter.use(auth, isRole('MEMBER'));
myMembershipRouter.get('/', memberMembershipController.listMine);
myMembershipRouter.patch(
  '/:id/auto-renew',
  validate({ params: membershipIdParamsSchema, body: autoRenewBodySchema }),
  memberMembershipController.setAutoRenew,
);
myMembershipRouter.post(
  '/:id/cancel',
  validate({ params: membershipIdParamsSchema }),
  memberMembershipController.cancelMine,
);
