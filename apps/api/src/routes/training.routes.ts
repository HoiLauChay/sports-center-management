import { evaluationIdParamsSchema, myEvaluationsQuerySchema, updateEvaluationBodySchema } from '@sports-center/shared';
import { Router } from 'express';

import trainingController from '~/controllers/training.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

export const myEvaluationRouter = Router();
myEvaluationRouter.use(auth, isRole('MEMBER'));
myEvaluationRouter.get('/', validate({ query: myEvaluationsQuerySchema }), trainingController.listMyEvaluations);

export const evaluationRouter = Router();
evaluationRouter.use(auth, isRole('COACH', 'MANAGER'));
evaluationRouter.patch(
  '/:id',
  validate({ params: evaluationIdParamsSchema, body: updateEvaluationBodySchema }),
  trainingController.updateEvaluation,
);
evaluationRouter.delete('/:id', validate({ params: evaluationIdParamsSchema }), trainingController.removeEvaluation);
