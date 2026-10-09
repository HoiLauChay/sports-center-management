import { reportDateQuerySchema, reportExportQuerySchema, reportRangeQuerySchema } from '@sports-center/shared';
import { Router } from 'express';

import reportController from '~/controllers/report.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const reportRouter = Router();

reportRouter.use(auth, isRole('MANAGER'));
reportRouter.get('/overview', reportController.overview);
reportRouter.get('/revenue', validate({ query: reportRangeQuerySchema }), reportController.revenue);
reportRouter.get('/wallet', validate({ query: reportRangeQuerySchema }), reportController.wallet);

reportRouter.get('/members', validate({ query: reportDateQuerySchema }), reportController.members);
reportRouter.get('/facilities', validate({ query: reportDateQuerySchema }), reportController.facilities);
reportRouter.get('/courses', validate({ query: reportDateQuerySchema }), reportController.courses);
reportRouter.get('/export', validate({ query: reportExportQuerySchema }), reportController.exportFile);

export default reportRouter;
