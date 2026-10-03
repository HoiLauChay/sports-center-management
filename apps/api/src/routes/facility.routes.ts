import {
  createFacilityBodySchema,
  facilityIdParamsSchema,
  facilityScheduleQuerySchema,
  listFacilitiesQuerySchema,
  updateFacilityBodySchema,
} from '@sports-center/shared';
import { Router } from 'express';

import facilityController from '~/controllers/facility.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const facilityRouter = Router();

facilityRouter.use(auth);
facilityRouter.get('/', validate({ query: listFacilitiesQuerySchema }), facilityController.list);
facilityRouter.get(
  '/:id/schedule',
  validate({ params: facilityIdParamsSchema, query: facilityScheduleQuerySchema }),
  facilityController.schedule,
);
facilityRouter.post('/', isRole('MANAGER'), validate({ body: createFacilityBodySchema }), facilityController.create);
facilityRouter.patch(
  '/:id',
  isRole('MANAGER'),
  validate({ params: facilityIdParamsSchema, body: updateFacilityBodySchema }),
  facilityController.update,
);
facilityRouter.delete(
  '/:id',
  isRole('MANAGER'),
  validate({ params: facilityIdParamsSchema }),
  facilityController.remove,
);

export default facilityRouter;
