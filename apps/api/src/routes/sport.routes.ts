import {
  createSportBodySchema,
  deleteSportQuerySchema,
  sportIdParamsSchema,
  updateSportBodySchema,
} from '@sports-center/shared';
import { Router } from 'express';

import sportController from '~/controllers/sport.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const sportRouter = Router();

sportRouter.use(auth);
sportRouter.get('/', sportController.list);
sportRouter.post('/', isRole('MANAGER'), validate({ body: createSportBodySchema }), sportController.create);
sportRouter.patch(
  '/:id',
  isRole('MANAGER'),
  validate({ params: sportIdParamsSchema, body: updateSportBodySchema }),
  sportController.update,
);
sportRouter.delete(
  '/:id',
  isRole('MANAGER'),
  validate({ params: sportIdParamsSchema, query: deleteSportQuerySchema }),
  sportController.remove,
);

export default sportRouter;
