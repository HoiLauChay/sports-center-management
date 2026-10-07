import { facilityPackagePreviewBodySchema } from '@sports-center/shared';
import { Router } from 'express';

import facilityPackageController from '~/controllers/facilityPackage.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const facilityPackageRouter = Router();

facilityPackageRouter.use(auth, isRole('MEMBER'));
facilityPackageRouter.post(
  '/preview',
  validate({ body: facilityPackagePreviewBodySchema }),
  facilityPackageController.preview,
);

export default facilityPackageRouter;
