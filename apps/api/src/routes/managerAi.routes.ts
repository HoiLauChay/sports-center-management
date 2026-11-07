import {
  automationKeyParamsSchema,
  bankTransactionIdParamsSchema,
  classIdParamsSchema,
  maintenanceAnnounceBodySchema,
  maintenanceIdParamsSchema,
  reportInsightBodySchema,
  supportIdParamsSchema,
  updateAutomationBodySchema,
} from '@sports-center/shared';
import { Router } from 'express';

import managerAiController from '~/controllers/managerAi.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { aiSuggestionLimit } from '~/middlewares/rateLimit.middlewares';
import { validate } from '~/utils/validation';

/** AI helpers inside the manager's pages (and the support page at the counter). Nothing here changes data, except announcing a maintenance and the automation switches. */
const managerAiRouter = Router();
managerAiRouter.use(auth);

managerAiRouter.post(
  '/support/:id/triage',
  isRole('MANAGER', 'RECEPTIONIST'),
  validate({ params: supportIdParamsSchema }),
  aiSuggestionLimit,
  managerAiController.supportTriage,
);

managerAiRouter.use(isRole('MANAGER'));
managerAiRouter.post(
  '/reports/insight',
  validate({ body: reportInsightBodySchema }),
  aiSuggestionLimit,
  managerAiController.reportInsight,
);
managerAiRouter.get('/digest', managerAiController.digest);
managerAiRouter.post(
  '/classes/:id/review',
  validate({ params: classIdParamsSchema }),
  aiSuggestionLimit,
  managerAiController.classReview,
);
managerAiRouter.get(
  '/classes/:id/coach-suggestions',
  validate({ params: classIdParamsSchema }),
  managerAiController.coachSuggestions,
);
managerAiRouter.get(
  '/bank-transactions/:id/suggestions',
  validate({ params: bankTransactionIdParamsSchema }),
  managerAiController.bankSuggestions,
);
managerAiRouter.post(
  '/maintenances/:id/notice',
  validate({ params: maintenanceIdParamsSchema }),
  aiSuggestionLimit,
  managerAiController.maintenanceNotice,
);
managerAiRouter.post(
  '/maintenances/:id/announce',
  validate({ params: maintenanceIdParamsSchema, body: maintenanceAnnounceBodySchema }),
  managerAiController.announceMaintenance,
);
managerAiRouter.get('/automations', managerAiController.automations);
managerAiRouter.patch(
  '/automations/:key',
  validate({ params: automationKeyParamsSchema, body: updateAutomationBodySchema }),
  managerAiController.updateAutomation,
);

export default managerAiRouter;
