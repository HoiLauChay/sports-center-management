import {
  ASSISTANT_ROLES,
  assistantChatBodySchema,
  assistantContextParamsSchema,
  assistantQuotaParamsSchema,
  listAssistantQuotasQuerySchema,
} from '@sports-center/shared';
import { Router } from 'express';

import assistantController from '~/controllers/assistant.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { assistantLimit } from '~/middlewares/rateLimit.middlewares';
import { validate } from '~/utils/validation';

const assistantRouter = Router();
assistantRouter.use(auth, isRole(...ASSISTANT_ROLES));
assistantRouter.post('/chat', validate({ body: assistantChatBodySchema }), assistantLimit, assistantController.chat);
assistantRouter.post(
  '/chat/stream',
  validate({ body: assistantChatBodySchema }),
  assistantLimit,
  assistantController.chatStream,
);
assistantRouter.delete(
  '/context/:conversationId',
  validate({ params: assistantContextParamsSchema }),
  assistantController.forget,
);
assistantRouter.get('/overview', assistantController.overview);
assistantRouter.get('/quota', assistantController.quota);
assistantRouter.get(
  '/quotas',
  isRole('MANAGER'),
  validate({ query: listAssistantQuotasQuerySchema }),
  assistantController.listQuotas,
);
assistantRouter.get(
  '/quotas/:accountId',
  isRole('MANAGER'),
  validate({ params: assistantQuotaParamsSchema }),
  assistantController.memberQuota,
);
assistantRouter.post('/quota/reset', isRole('MANAGER'), assistantController.resetQuotas);
assistantRouter.post(
  '/quotas/:accountId/reset',
  isRole('MANAGER'),
  validate({ params: assistantQuotaParamsSchema }),
  assistantController.resetQuotas,
);

export default assistantRouter;
