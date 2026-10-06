import type { OrderItemType } from '@sports-center/shared';

import { courseEnrollmentHandler } from '~/services/checkout/lines/courseEnrollment';
import { facilityBookingHandler } from '~/services/checkout/lines/facilityBooking';
import type { AnyLineHandler } from '~/services/checkout/types';

export const lineHandlers: Partial<Record<OrderItemType, AnyLineHandler>> = {
  FACILITY_BOOKING: facilityBookingHandler,
  COURSE_ENROLLMENT: courseEnrollmentHandler,
};
