import { listUsersQuerySchema, userIdParamsSchema } from '@sports-center/shared';
import { Router } from 'express';

import usersController from '~/controllers/users.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const usersRouter = Router();

usersRouter.use(auth, isRole('MANAGER', 'RECEPTIONIST'));
usersRouter.get('/', validate({ query: listUsersQuerySchema }), usersController.list);
usersRouter.get('/:id', validate({ params: userIdParamsSchema }), usersController.getById);

export default usersRouter;
