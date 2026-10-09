import { listMaintenancesQuerySchema, maintenanceWindowSchema } from '@sports-center/shared';
import { Router } from 'express';

import maintenanceController from '~/controllers/maintenance.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const maintenanceRouter = Router();
maintenanceRouter.use(auth);
maintenanceRouter.get(
  '/',
  isRole('MANAGER', 'RECEPTIONIST'),
  validate({ query: listMaintenancesQuerySchema }),
  maintenanceController.list,
);
maintenanceRouter.post(
  '/preview',
  isRole('MANAGER'),
  validate({ body: maintenanceWindowSchema }),
  maintenanceController.preview,
);

export default maintenanceRouter;
