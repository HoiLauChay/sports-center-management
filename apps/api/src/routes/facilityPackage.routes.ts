import { facilityPackagePreviewBodySchema } from '@sports-center/shared';
import { Router } from 'express';

import facilityPackageController from '~/controllers/facilityPackage.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

export const myFacilityPackageRouter = Router();
myFacilityPackageRouter.use(auth, isRole('MEMBER'));
myFacilityPackageRouter.get('/', facilityPackageController.listMine);

export const facilityPackageRouter = Router();
facilityPackageRouter.use(auth, isRole('MEMBER', 'RECEPTIONIST'));
facilityPackageRouter.post(
  '/preview',
  validate({ body: facilityPackagePreviewBodySchema }),
  facilityPackageController.preview,
);
