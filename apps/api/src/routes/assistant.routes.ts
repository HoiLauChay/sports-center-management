import { ASSISTANT_ROLES, assistantChatBodySchema, assistantContextParamsSchema } from '@sports-center/shared';
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

export default assistantRouter;
