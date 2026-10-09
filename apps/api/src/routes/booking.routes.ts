import { bookingIdParamsSchema, listBookingsQuerySchema, listMyBookingsQuerySchema } from '@sports-center/shared';
import { Router } from 'express';

import bookingController from '~/controllers/booking.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

export const bookingRouter = Router();
bookingRouter.use(auth);
bookingRouter.get(
  '/',
  isRole('MANAGER', 'RECEPTIONIST'),
  validate({ query: listBookingsQuerySchema }),
  bookingController.list,
);
bookingRouter.get(
  '/:id',
  isRole('MEMBER', 'MANAGER', 'RECEPTIONIST'),
  validate({ params: bookingIdParamsSchema }),
  bookingController.get,
);

export const myBookingRouter = Router();
myBookingRouter.use(auth, isRole('MEMBER'));
myBookingRouter.get('/', validate({ query: listMyBookingsQuerySchema }), bookingController.listMine);

export const myFacilityPackageRouter = Router();
myFacilityPackageRouter.use(auth, isRole('MEMBER'));
myFacilityPackageRouter.get('/', bookingController.listPackagesMine);
