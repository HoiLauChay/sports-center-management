import { ASSISTANT_ROLES, assistantChatBodySchema } from '@sports-center/shared';
import { Router } from 'express';

import assistantController from '~/controllers/assistant.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { assistantLimit } from '~/middlewares/rateLimit.middlewares';
import { validate } from '~/utils/validation';

const assistantRouter = Router();
assistantRouter.use(auth, isRole(...ASSISTANT_ROLES));
assistantRouter.post('/chat', validate({ body: assistantChatBodySchema }), assistantLimit, assistantController.chat);
assistantRouter.get('/overview', assistantController.overview);

export default assistantRouter;
