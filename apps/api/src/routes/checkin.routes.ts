import { createCheckInBodySchema, listCheckInsQuerySchema, listMyCheckInsQuerySchema } from '@sports-center/shared';
import { Router } from 'express';

import checkinController from '~/controllers/checkin.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

export const myCheckinRouter = Router();
myCheckinRouter.use(auth, isRole('MEMBER'));
myCheckinRouter.get('/', validate({ query: listMyCheckInsQuerySchema }), checkinController.listMine);

export const checkinRouter = Router();
checkinRouter.use(auth);
checkinRouter.post('/', isRole('RECEPTIONIST'), validate({ body: createCheckInBodySchema }), checkinController.create);
checkinRouter.get(
  '/',
  isRole('RECEPTIONIST', 'MANAGER'),
  validate({ query: listCheckInsQuerySchema }),
  checkinController.list,
);
