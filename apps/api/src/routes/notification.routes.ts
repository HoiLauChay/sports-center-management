import { listNotificationsQuerySchema, notificationIdParamsSchema } from '@sports-center/shared';
import { Router } from 'express';

import notificationController from '~/controllers/notification.controllers';
import { auth } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const notificationRouter = Router();

notificationRouter.use(auth);
notificationRouter.get('/', validate({ query: listNotificationsQuerySchema }), notificationController.list);
notificationRouter.patch(
  '/:id/read',
  validate({ params: notificationIdParamsSchema }),
  notificationController.markRead,
);
notificationRouter.post('/read-all', notificationController.markAllRead);

export default notificationRouter;
