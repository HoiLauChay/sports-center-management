import { courseIdParamsSchema, createCourseBodySchema, updateCourseBodySchema } from '@sports-center/shared';
import { Router } from 'express';

import courseController from '~/controllers/course.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const courseRouter = Router();

courseRouter.use(auth);
courseRouter.get('/', courseController.list);
courseRouter.post('/', isRole('MANAGER'), validate({ body: createCourseBodySchema }), courseController.create);
courseRouter.patch(
  '/:id',
  isRole('MANAGER'),
  validate({ params: courseIdParamsSchema, body: updateCourseBodySchema }),
  courseController.update,
);
courseRouter.delete('/:id', isRole('MANAGER'), validate({ params: courseIdParamsSchema }), courseController.remove);

export default courseRouter;
