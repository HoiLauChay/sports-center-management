import {
  counterTopUpBodySchema,
  createUserBodySchema,
  listUsersQuerySchema,
  memberMembershipParamsSchema,
  updateUserBodySchema,
  updateUserStatusBodySchema,
  userIdParamsSchema,
  walletQuerySchema,
} from '@sports-center/shared';
import { Router } from 'express';

import memberMembershipController from '~/controllers/memberMembership.controllers';
import userController from '~/controllers/user.controllers';
import walletController from '~/controllers/wallet.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const userRouter = Router();

userRouter.use(auth);
userRouter.get('/', isRole('MANAGER', 'RECEPTIONIST'), validate({ query: listUsersQuerySchema }), userController.list);
userRouter.get(
  '/:id',
  isRole('MANAGER', 'RECEPTIONIST'),
  validate({ params: userIdParamsSchema }),
  userController.getById,
);
userRouter.get(
  '/:id/wallet',
  isRole('MANAGER', 'RECEPTIONIST'),
  validate({ params: userIdParamsSchema, query: walletQuerySchema }),
  walletController.getForMember,
);
userRouter.get(
  '/:id/memberships',
  isRole('MANAGER', 'RECEPTIONIST'),
  validate({ params: userIdParamsSchema }),
  memberMembershipController.listForMember,
);
userRouter.post(
  '/:id/memberships/:membershipId/cancel',
  isRole('MANAGER', 'RECEPTIONIST'),
  validate({ params: memberMembershipParamsSchema }),
  memberMembershipController.cancelForMember,
);
userRouter.post(
  '/:id/wallet/top-ups',
  isRole('RECEPTIONIST'),
  validate({ params: userIdParamsSchema, body: counterTopUpBodySchema }),
  walletController.topUpAtCounter,
);
userRouter.post('/', isRole('MANAGER'), validate({ body: createUserBodySchema }), userController.create);
userRouter.patch(
  '/:id',
  isRole('MANAGER'),
  validate({ params: userIdParamsSchema, body: updateUserBodySchema }),
  userController.update,
);
userRouter.patch(
  '/:id/status',
  isRole('MANAGER'),
  validate({ params: userIdParamsSchema, body: updateUserStatusBodySchema }),
  userController.updateStatus,
);

export default userRouter;
