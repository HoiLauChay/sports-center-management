import { reportRangeQuerySchema } from '@sports-center/shared';
import { Router } from 'express';

import reportController from '~/controllers/report.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const reportRouter = Router();

reportRouter.use(auth, isRole('MANAGER'));
reportRouter.get('/overview', reportController.overview);
reportRouter.get('/revenue', validate({ query: reportRangeQuerySchema }), reportController.revenue);
reportRouter.get('/wallet', validate({ query: reportRangeQuerySchema }), reportController.wallet);

export default reportRouter;
