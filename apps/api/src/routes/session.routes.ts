import { saveAttendanceBodySchema, sessionIdParamsSchema, updateSessionBodySchema } from '@sports-center/shared';
import { Router } from 'express';

import attendanceController from '~/controllers/attendance.controllers';
import sessionController from '~/controllers/session.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const sessionRouter = Router();
sessionRouter.use(auth);
sessionRouter.patch(
  '/:id',
  isRole('MANAGER'),
  validate({ params: sessionIdParamsSchema, body: updateSessionBodySchema }),
  sessionController.update,
);
sessionRouter.get(
  '/:id/attendance',
  isRole('COACH', 'MANAGER'),
  validate({ params: sessionIdParamsSchema }),
  attendanceController.list,
);
sessionRouter.put(
  '/:id/attendance',
  isRole('COACH', 'MANAGER'),
  validate({ params: sessionIdParamsSchema, body: saveAttendanceBodySchema }),
  attendanceController.save,
);

export default sessionRouter;
