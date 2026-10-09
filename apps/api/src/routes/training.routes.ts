import {
  classIdParamsSchema,
  createAnnouncementBodySchema,
  createEvaluationBodySchema,
  evaluationIdParamsSchema,
  myEvaluationsQuerySchema,
  saveSessionNoteBodySchema,
  sessionIdParamsSchema,
  updateEvaluationBodySchema,
} from '@sports-center/shared';
import { Router } from 'express';

import trainingController from '~/controllers/training.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

export const myEvaluationRouter = Router();
myEvaluationRouter.use(auth, isRole('MEMBER'));
myEvaluationRouter.get('/', validate({ query: myEvaluationsQuerySchema }), trainingController.listMyEvaluations);

export const sessionTrainingRouter = Router();
sessionTrainingRouter.use(auth);
sessionTrainingRouter.get(
  '/:id/notes',
  isRole('COACH', 'MANAGER', 'MEMBER'),
  validate({ params: sessionIdParamsSchema }),
  trainingController.getNote,
);
sessionTrainingRouter.put(
  '/:id/notes',
  isRole('COACH'),
  validate({ params: sessionIdParamsSchema, body: saveSessionNoteBodySchema }),
  trainingController.saveNote,
);
sessionTrainingRouter.get(
  '/:id/evaluations',
  isRole('COACH', 'MANAGER'),
  validate({ params: sessionIdParamsSchema }),
  trainingController.listSessionEvaluations,
);
sessionTrainingRouter.post(
  '/:id/evaluations',
  isRole('COACH'),
  validate({ params: sessionIdParamsSchema, body: createEvaluationBodySchema }),
  trainingController.createEvaluation,
);

export const evaluationRouter = Router();
evaluationRouter.use(auth, isRole('COACH', 'MANAGER'));
evaluationRouter.patch(
  '/:id',
  validate({ params: evaluationIdParamsSchema, body: updateEvaluationBodySchema }),
  trainingController.updateEvaluation,
);
evaluationRouter.delete('/:id', validate({ params: evaluationIdParamsSchema }), trainingController.removeEvaluation);

export const classAnnouncementRouter = Router();
classAnnouncementRouter.use(auth, isRole('COACH', 'MANAGER'));
classAnnouncementRouter.post(
  '/:id/announcements',
  validate({ params: classIdParamsSchema, body: createAnnouncementBodySchema }),
  trainingController.announce,
);
