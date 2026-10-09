import {
  attendanceSessionParamsSchema,
  myAttendanceQuerySchema,
  saveAttendanceBodySchema,
} from '@sports-center/shared';
import { Router } from 'express';

import attendanceController from '~/controllers/attendance.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

export const sessionAttendanceRouter = Router();
sessionAttendanceRouter.use(auth, isRole('COACH', 'MANAGER'));
sessionAttendanceRouter.get(
  '/:id/attendance',
  validate({ params: attendanceSessionParamsSchema }),
  attendanceController.list,
);
sessionAttendanceRouter.put(
  '/:id/attendance',
  validate({ params: attendanceSessionParamsSchema, body: saveAttendanceBodySchema }),
  attendanceController.save,
);

export const myAttendanceRouter = Router();
myAttendanceRouter.use(auth, isRole('MEMBER'));
myAttendanceRouter.get('/', validate({ query: myAttendanceQuerySchema }), attendanceController.listMine);
