import { Router } from 'express';

import cronController from '~/controllers/cron.controllers';
import { cronAuth } from '~/middlewares/cron.middlewares';

const cronRouter = Router();

cronRouter.use(cronAuth);
cronRouter.post('/cleanup', cronController.cleanup);
cronRouter.post('/attendance-defaults', cronController.attendanceDefaults);
cronRouter.post('/memberships', cronController.memberships);
cronRouter.post('/sepay-sync', cronController.sepaySync);

export default cronRouter;
