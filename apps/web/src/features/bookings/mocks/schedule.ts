import type { Facility, SystemSettings } from '@sports-center/shared';
import { classesDb } from '~/features/classes/mocks/classes';
import { commerceStore } from '~/lib/mock/commerce';
import { fromMinutes, isPast, overlaps, parseDate, recurringDates, toMinutes, todayVN } from '~/lib/time';
import type { Booking, PackageConflict, PackagePreview, PackagePreviewRequest } from '../types';

export interface SlotProblem {
  code: 'INVALID_SLOT' | 'PAST_SLOT' | 'TOO_FAR' | 'FACILITY_INACTIVE' | 'SLOT_TAKEN' | 'CLASS_CONFLICT';
  message: string;
}

export interface PendingBooking {
  facilityId: string;
  date: string;
  startTime: string;
  endTime: string;
}

const liveBookings = () => commerceStore.get().bookings.filter((booking) => booking.status === 'CONFIRMED');

function bookedAt(bookings: Booking[], facilityId: string, date: string, startTime: string, endTime: string) {
  return bookings.filter(
    (booking) =>
      booking.facility.id === facilityId &&
      booking.date === date &&
      overlaps(startTime, endTime, booking.startTime, booking.endTime),
  ).length;
}

const onGrid = (settings: SystemSettings, startTime: string, endTime: string) => {
  const open = toMinutes(settings.openTime);
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  return (
    start >= open &&
    end <= toMinutes(settings.closeTime) &&
    start < end &&
    (start - open) % settings.slotDurationMinutes === 0 &&
    (end - start) % settings.slotDurationMinutes === 0
  );
};

/**
 * Why a single booking cannot be made (BR_2.1–2.4, BR_2.19). `pending` are the other bookings in the same draft order,
 * which compete for the same capacity even though nothing is reserved yet (BR_3.18).
 */
export function bookingProblem(
  facility: Facility | undefined,
  settings: SystemSettings,
  selection: PendingBooking,
  pending: PendingBooking[] = [],
): SlotProblem | null {
  const { date, startTime, endTime } = selection;
  if (!facility) return { code: 'INVALID_SLOT', message: 'Không tìm thấy sân / phòng' };
  if (!facility.isActive) return { code: 'FACILITY_INACTIVE', message: `${facility.name} đang ngừng nhận đặt` };
  if (!onGrid(settings, startTime, endTime)) {
    return {
      code: 'INVALID_SLOT',
      message: `Khung giờ phải khớp lưới slot ${settings.slotDurationMinutes} phút (${settings.openTime}–${settings.closeTime})`,
    };
  }
  if (isPast(date, startTime)) return { code: 'PAST_SLOT', message: 'Khung giờ đã qua' };
  if (parseDate(date).diff(parseDate(todayVN()), 'day') > settings.maxAdvanceBookingDays) {
    return { code: 'TOO_FAR', message: `Chỉ được đặt trước tối đa ${settings.maxAdvanceBookingDays} ngày` };
  }
  const session = classesDb
    .sessionsAt(facility.id, date)
    .find((entry) => overlaps(startTime, endTime, entry.session.startTime, entry.session.endTime));
  if (session) return { code: 'CLASS_CONFLICT', message: `Khung giờ có lớp "${session.className}"` };

  const bookings = liveBookings();
  const step = settings.slotDurationMinutes;
  for (let at = toMinutes(startTime); at < toMinutes(endTime); at += step) {
    const slotStart = fromMinutes(at);
    const slotEnd = fromMinutes(at + step);
    const taken =
      bookedAt(bookings, facility.id, date, slotStart, slotEnd) +
      pending.filter(
        (other) =>
          other.facilityId === facility.id &&
          other.date === date &&
          overlaps(slotStart, slotEnd, other.startTime, other.endTime),
      ).length;
    if (taken >= facility.capacityPerSlot) {
      return {
        code: 'SLOT_TAKEN',
        message:
          facility.capacityPerSlot === 1
            ? `Khung ${slotStart}–${slotEnd} đã có người đặt`
            : `Khung ${slotStart}–${slotEnd} đã đủ ${facility.capacityPerSlot} chỗ`,
      };
    }
  }
  return null;
}

/** Every date of a recurring package that is still in the future (a package never starts in the past). */
export function packageDates(request: Pick<PackagePreviewRequest, 'startDate' | 'daysOfWeek' | 'weeks' | 'startTime'>) {
  return recurringDates(request.startDate, request.daysOfWeek, request.weeks).filter(
    (date) => !isPast(date, request.startTime),
  );
}

/** `POST /facility-packages/preview`: any slot with a booking, class or closure invalidates the whole package. */
export function previewPackage(
  facility: Facility,
  settings: SystemSettings,
  request: PackagePreviewRequest,
  pricePerSlot: number,
  slotsPerBooking: number,
): PackagePreview {
  const bookings = liveBookings();
  const dates = packageDates(request);
  const entries = dates.map((date) => {
    const { startTime, endTime } = request;
    let conflict: PackageConflict | undefined;
    if (!facility.isActive || !onGrid(settings, startTime, endTime)) conflict = 'CLOSED';
    else if (
      classesDb
        .sessionsAt(facility.id, date)
        .some((entry) => overlaps(startTime, endTime, entry.session.startTime, entry.session.endTime))
    ) {
      conflict = 'CLASS';
    } else if (bookedAt(bookings, facility.id, date, startTime, endTime) > 0) conflict = 'BOOKED';
    return { date, startTime, endTime, available: !conflict, ...(conflict ? { conflict } : {}) };
  });
  const basePrice = pricePerSlot * slotsPerBooking * entries.length;
  return {
    bookings: entries,
    isValid: entries.length > 0 && entries.every((entry) => entry.available),
    unitPrice: pricePerSlot * slotsPerBooking,
    basePrice,
  };
}
