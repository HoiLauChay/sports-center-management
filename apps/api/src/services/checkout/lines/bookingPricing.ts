import type { BookingBenefit } from '@sports-center/shared';

import bookingRepository from '~/repositories/booking.repository';
import { plannedFor } from '~/services/checkout/lines/shared';
import type { CheckoutContext, Db } from '~/services/checkout/types';
import { percentOf } from '~/utils/money';
import { formatDate, fromDbTime } from '~/utils/time';

export interface BookedSlots {
  date: string;
  slots: number;
  benefit: BookingBenefit;
}

export interface PricedBooking extends BookedSlots {
  subtotal: number;
  discount: number;
  discountPct: number;
}

interface PricedFacility {
  type: string;
  pricePerSlot: unknown;
}

const monthOf = (date: string) => {
  const [year, month] = date.split('-').map(Number);
  return { from: `${date.slice(0, 7)}-01`, to: formatDate(new Date(Date.UTC(year!, month!, 1))) };
};

const plannedBookings = (ctx: CheckoutContext, accountId: string): BookedSlots[] =>
  plannedFor(ctx, accountId).flatMap(({ type, data }) => {
    if (type === 'FACILITY_BOOKING') return [data as BookedSlots];
    if (type === 'FACILITY_PACKAGE') return (data as { bookings: BookedSlots[] }).bookings;
    return [];
  });

const freeSlotsUsed = async (db: Db, ctx: CheckoutContext, accountId: string, from: string, to: string) => {
  const slotMinutes = ctx.settings.slotDurationMinutes;
  const booked = (await bookingRepository.findFreeSlotTimes(accountId, from, to, db)).reduce(
    (sum, { startTime, endTime }) => sum + (fromDbTime(endTime) - fromDbTime(startTime)) / slotMinutes,
    0,
  );
  const planned = plannedBookings(ctx, accountId)
    .filter(({ benefit, date }) => benefit === 'FREE_SLOT' && from <= date && date < to)
    .reduce((sum, { slots }) => sum + slots, 0);
  return booked + planned;
};

export const priceBookings = async (
  db: Db,
  ctx: CheckoutContext,
  facility: PricedFacility,
  items: { date: string; slots: number }[],
): Promise<PricedBooking[]> => {
  const unitPrice = Number(facility.pricePerSlot);
  const usedByMonth = new Map<string, number>();
  const priced: PricedBooking[] = [];

  for (const { date, slots } of items) {
    const subtotal = unitPrice * slots;
    const pick = async (): Promise<{ benefit: BookingBenefit; discountPct: number }> => {
      if (ctx.buyer.kind === 'GUEST' || !ctx.benefits) return { benefit: 'NONE', discountPct: 0 };
      const current = ctx.benefits.current;
      if (facility.type === 'GYM' && current?.gymAccess) return { benefit: 'GYM_ACCESS', discountPct: 100 };

      const quota = ctx.benefits.periodOn(date)?.freeBookingSlotsPerMonth ?? 0;
      if (quota >= slots) {
        const { from, to } = monthOf(date);
        const used = usedByMonth.get(from) ?? (await freeSlotsUsed(db, ctx, ctx.buyer.accountId, from, to));
        usedByMonth.set(from, used);
        if (quota - used >= slots) {
          usedByMonth.set(from, used + slots);
          return { benefit: 'FREE_SLOT', discountPct: 100 };
        }
      }
      const pct = current?.bookingDiscountPct ?? 0;
      return pct > 0 ? { benefit: 'DISCOUNT', discountPct: pct } : { benefit: 'NONE', discountPct: 0 };
    };
    const { benefit, discountPct } = await pick();
    priced.push({ date, slots, benefit, subtotal, discountPct, discount: percentOf(subtotal, discountPct) });
  }
  return priced;
};
