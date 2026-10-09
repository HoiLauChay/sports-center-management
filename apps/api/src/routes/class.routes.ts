import {
  assignCoachBodySchema,
  cancelClassBodySchema,
  classIdParamsSchema,
  createClassBodySchema,
  listClassesQuerySchema,
  reviewClassBodySchema,
  updateClassBodySchema,
} from '@sports-center/shared';
import { Router } from 'express';

import classController from '~/controllers/class.controllers';
import enrollmentController from '~/controllers/enrollment.controllers';
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
classRouter.post(
  '/:id/approve',
  isRole('MANAGER'),
  validate({ params: classIdParamsSchema, body: reviewClassBodySchema }),
  classController.approve,
);
classRouter.post(
  '/:id/reject',
  isRole('MANAGER'),
  validate({ params: classIdParamsSchema, body: reviewClassBodySchema }),
  classController.reject,
);

classRouter.post(
  '/:id/cancel',
  isRole('MANAGER'),
  validate({ params: classIdParamsSchema, body: cancelClassBodySchema }),
  classController.cancel,
);

classRouter.post(
  '/:id/coach-registrations',
  isRole('COACH'),
  validate({ params: classIdParamsSchema }),
  classController.registerCoach,
);
classRouter.get(
  '/:id/coach-registrations',
  isRole('MANAGER'),
  validate({ params: classIdParamsSchema }),
  classController.listCoachRegistrations,
);
classRouter.post(
  '/:id/assign-coach',
  isRole('MANAGER'),
  validate({ params: classIdParamsSchema, body: assignCoachBodySchema }),
  classController.assignCoach,
);
classRouter.post(
  '/:id/withdraw',
  isRole('COACH'),
  validate({ params: classIdParamsSchema }),
  classController.withdrawCoach,
);

classRouter.get(
  '/:id/enrollments',
  isRole('COACH', 'MANAGER', 'RECEPTIONIST'),
  validate({ params: classIdParamsSchema }),
  enrollmentController.listForClass,
);

export default classRouter;
