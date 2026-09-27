import { createUserBodySchema, listUsersQuerySchema, userIdParamsSchema } from '@sports-center/shared';
import { Router } from 'express';

import userController from '~/controllers/user.controllers';
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
userRouter.post('/', isRole('MANAGER'), validate({ body: createUserBodySchema }), userController.create);

export default userRouter;
