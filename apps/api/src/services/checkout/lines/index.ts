import type { OrderItemType } from '@sports-center/shared';

import { courseEnrollmentHandler } from '~/services/checkout/lines/courseEnrollment';
import { facilityBookingHandler } from '~/services/checkout/lines/facilityBooking';
import { facilityPackageHandler } from '~/services/checkout/lines/facilityPackage';
import { membershipHandler } from '~/services/checkout/lines/membership';
import type { AnyLineHandler } from '~/services/checkout/types';

export const lineHandlers: Partial<Record<OrderItemType, AnyLineHandler>> = {
  FACILITY_BOOKING: facilityBookingHandler,
  FACILITY_PACKAGE: facilityPackageHandler,
  COURSE_ENROLLMENT: courseEnrollmentHandler,
  MEMBERSHIP: membershipHandler,
};
