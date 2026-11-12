import {
  changeUserEmailBodySchema,
  counterTopUpBodySchema,
  createUserBodySchema,
  listUsersQuerySchema,
  memberMembershipParamsSchema,
  subscribeMemberBodySchema,
  terminateMembershipBodySchema,
  updateUserBodySchema,
  updateUserRolesBodySchema,
  updateUserStatusBodySchema,
  userIdParamsSchema,
  walletQuerySchema,
} from '@sports-center/shared';
import { Router, type NextFunction, type Request, type Response } from 'express';

import memberMembershipController from '~/controllers/memberMembership.controllers';
import userController from '~/controllers/user.controllers';
import walletController from '~/controllers/wallet.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import userService from '~/services/user.service';
import { validate } from '~/utils/validation';

const userRouter = Router();

const managed = async (req: Request, _res: Response, next: NextFunction) => {
  await userService.assertManaged(req.user!, req.params.id as string);
  next();
};

userRouter.use(auth);
userRouter.get('/', isRole('MANAGER', 'RECEPTIONIST'), validate({ query: listUsersQuerySchema }), userController.list);
userRouter.get(
  '/:id',
  isRole('MANAGER', 'RECEPTIONIST', 'COACH'),
  validate({ params: userIdParamsSchema }),
  userController.getById,
);
userRouter.get(
  '/:id/wallet',
  isRole('MANAGER', 'RECEPTIONIST'),
  validate({ params: userIdParamsSchema, query: walletQuerySchema }),
  managed,
  walletController.getForMember,
);
userRouter.get(
  '/:id/memberships',
  isRole('MANAGER', 'RECEPTIONIST'),
  validate({ params: userIdParamsSchema }),
  managed,
  memberMembershipController.listForMember,
);
userRouter.post(
  '/:id/memberships/:membershipId/cancel',
  isRole('MANAGER', 'RECEPTIONIST'),
  validate({ params: memberMembershipParamsSchema }),
  managed,
  memberMembershipController.cancelForMember,
);
userRouter.post(
  '/:id/memberships',
  isRole('MANAGER', 'RECEPTIONIST'),
  validate({ params: userIdParamsSchema, body: subscribeMemberBodySchema }),
  managed,
  memberMembershipController.subscribeForMember,
);
userRouter.post(
  '/:id/memberships/:membershipId/terminate',
  isRole('MANAGER', 'RECEPTIONIST'),
  validate({ params: memberMembershipParamsSchema, body: terminateMembershipBodySchema }),
  managed,
  memberMembershipController.terminateForMember,
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
userRouter.put(
  '/:id/roles',
  isRole('MANAGER'),
  validate({ params: userIdParamsSchema, body: updateUserRolesBodySchema }),
  userController.updateRoles,
);
userRouter.patch(
  '/:id/email',
  isRole('MANAGER'),
  validate({ params: userIdParamsSchema, body: changeUserEmailBodySchema }),
  userController.changeEmail,
);

export default userRouter;
