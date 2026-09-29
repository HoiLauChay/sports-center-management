import { listAuditLogsQuerySchema } from '@sports-center/shared';
import { Router } from 'express';

import auditController from '~/controllers/audit.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const auditRouter = Router();

auditRouter.use(auth, isRole('MANAGER'));
auditRouter.get('/', validate({ query: listAuditLogsQuerySchema }), auditController.list);

export default auditRouter;
