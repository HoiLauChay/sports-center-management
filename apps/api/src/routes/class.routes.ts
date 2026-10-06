import {
  classIdParamsSchema,
  createClassBodySchema,
  listClassesQuerySchema,
  updateClassBodySchema,
} from '@sports-center/shared';
import { Router } from 'express';

import classController from '~/controllers/class.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const classRouter = Router();

classRouter.use(auth);
classRouter.get('/', validate({ query: listClassesQuerySchema }), classController.list);
classRouter.get('/:id', validate({ params: classIdParamsSchema }), classController.get);
classRouter.post('/', isRole('MANAGER'), validate({ body: createClassBodySchema }), classController.create);
classRouter.patch(
  '/:id',
  isRole('MANAGER'),
  validate({ params: classIdParamsSchema, body: updateClassBodySchema }),
  classController.update,
);
classRouter.post('/:id/approve', isRole('MANAGER'), validate({ params: classIdParamsSchema }), classController.approve);
classRouter.post('/:id/reject', isRole('MANAGER'), validate({ params: classIdParamsSchema }), classController.reject);

export default classRouter;
