import {
  createEvaluationBodySchema,
  listSessionsQuerySchema,
  saveAttendanceBodySchema,
  saveSessionNoteBodySchema,
  sessionIdParamsSchema,
  updateSessionBodySchema,
} from '@sports-center/shared';
import { Router } from 'express';

import attendanceController from '~/controllers/attendance.controllers';
import sessionController from '~/controllers/session.controllers';
import trainingController from '~/controllers/training.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const sessionRouter = Router();
sessionRouter.use(auth);
sessionRouter.get(
  '/',
  isRole('MANAGER', 'RECEPTIONIST'),
  validate({ query: listSessionsQuerySchema }),
  sessionController.list,
);
sessionRouter.get(
  '/:id',
  isRole('COACH', 'MANAGER'),
  validate({ params: sessionIdParamsSchema }),
  sessionController.get,
);
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
sessionRouter.get(
  '/:id/notes',
  isRole('COACH', 'MANAGER', 'MEMBER'),
  validate({ params: sessionIdParamsSchema }),
  trainingController.getNote,
);
sessionRouter.put(
  '/:id/notes',
  isRole('COACH'),
  validate({ params: sessionIdParamsSchema, body: saveSessionNoteBodySchema }),
  trainingController.saveNote,
);
sessionRouter.get(
  '/:id/evaluations',
  isRole('COACH', 'MANAGER'),
  validate({ params: sessionIdParamsSchema }),
  trainingController.listSessionEvaluations,
);
sessionRouter.post(
  '/:id/evaluations',
  isRole('COACH'),
  validate({ params: sessionIdParamsSchema, body: createEvaluationBodySchema }),
  trainingController.createEvaluation,
);

export default sessionRouter;
