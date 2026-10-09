import type { Ref } from '@sports-center/shared';
import { commerceStore } from '~/lib/mock/commerce';

/** Moves a booking to another facility at the same time because its facility goes into maintenance (BR_2.19). */
export function moveBookingForMaintenance(bookingId: string, facility: Ref) {
  commerceStore.update((state) => {
    const booking = state.bookings.find((entry) => entry.id === bookingId);
    if (booking?.status === 'CONFIRMED') booking.facility = facility;
  });
}
