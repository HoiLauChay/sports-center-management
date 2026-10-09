import { myAttendanceQuerySchema } from '@sports-center/shared';
import { Router } from 'express';

import attendanceController from '~/controllers/attendance.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

export const myAttendanceRouter = Router();
myAttendanceRouter.use(auth, isRole('MEMBER'));
myAttendanceRouter.get('/', validate({ query: myAttendanceQuerySchema }), attendanceController.listMine);
