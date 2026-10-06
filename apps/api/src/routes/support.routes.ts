import {
  createSupportBodySchema,
  listSupportQuerySchema,
  supportIdParamsSchema,
  updateSupportBodySchema,
} from '@sports-center/shared';
import { Router } from 'express';

import supportController from '~/controllers/support.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

export const mySupportRouter = Router();
mySupportRouter.use(auth, isRole('MEMBER'));
mySupportRouter.get('/', supportController.listMine);

export const supportRouter = Router();
supportRouter.use(auth);
supportRouter.post('/', isRole('MEMBER'), validate({ body: createSupportBodySchema }), supportController.create);
supportRouter.get(
  '/',
  isRole('RECEPTIONIST', 'MANAGER'),
  validate({ query: listSupportQuerySchema }),
  supportController.list,
);
supportRouter.get(
  '/:id',
  isRole('MEMBER', 'RECEPTIONIST', 'MANAGER'),
  validate({ params: supportIdParamsSchema }),
  supportController.get,
);
supportRouter.patch(
  '/:id',
  isRole('RECEPTIONIST', 'MANAGER'),
  validate({ params: supportIdParamsSchema, body: updateSupportBodySchema }),
  supportController.update,
);
