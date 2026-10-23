import {
  classIdParamsSchema,
  evaluationIdParamsSchema,
  myEvaluationsQuerySchema,
  updateEvaluationBodySchema,
} from '@sports-center/shared';
import { Router } from 'express';

import classTrainingController from '~/controllers/classTraining.controllers';
import trainingController from '~/controllers/training.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

export const myEvaluationRouter = Router();
myEvaluationRouter.use(auth, isRole('MEMBER'));
myEvaluationRouter.get('/', validate({ query: myEvaluationsQuerySchema }), trainingController.listMyEvaluations);

export const myClassRouter = Router();
myClassRouter.use(auth, isRole('MEMBER'));
myClassRouter.get('/:id/training', validate({ params: classIdParamsSchema }), classTrainingController.myTraining);

export const evaluationRouter = Router();
evaluationRouter.use(auth, isRole('COACH', 'MANAGER'));
evaluationRouter.patch(
  '/:id',
  validate({ params: evaluationIdParamsSchema, body: updateEvaluationBodySchema }),
  trainingController.updateEvaluation,
);
evaluationRouter.delete('/:id', validate({ params: evaluationIdParamsSchema }), trainingController.removeEvaluation);
