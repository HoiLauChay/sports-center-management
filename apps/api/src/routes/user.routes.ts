import {
  createUserBodySchema,
  listUsersQuerySchema,
  updateUserBodySchema,
  updateUserStatusBodySchema,
  userIdParamsSchema,
  walletQuerySchema,
} from '@sports-center/shared';
import { Router } from 'express';

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
