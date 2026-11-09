import {
  ERROR_CODE,
  type CheckoutItemInput,
  type FacilityPackagePreviewBody,
  type FacilityPackageSnapshot,
  type ScheduleClashReason,
} from '@sports-center/shared';

import bookingRepository from '~/repositories/booking.repository';
import facilityRepository from '~/repositories/facility.repository';
import scheduleRepository from '~/repositories/schedule.repository';
import { priceBookings, type BookedSlots } from '~/services/checkout/lines/bookingPricing';
import { busyInOrder, CLASH_MESSAGE, lineError } from '~/services/checkout/lines/shared';
import type { CheckoutContext, Db, LineHandler } from '~/services/checkout/types';
import scheduleService, { type PlannedUse, type TimeRange } from '~/services/schedule.service';
import { addDays, formatCenterDate, parseTime, toCenterDateTime, toDbTime } from '~/utils/time';

type PackageInput = Extract<CheckoutItemInput, { type: 'FACILITY_PACKAGE' }>;

interface PackageData {
  facilityId: string;
  startDate: string;
  endDate: string;
  daysOfWeek: number[];
  start: number;
  end: number;
  unitPrice: number;
  bookings: BookedSlots[];
}

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const dayOfWeek = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

export const planPackage = async (db: Db, ctx: CheckoutContext, input: FacilityPackagePreviewBody) => {
  const facility = await facilityRepository.findById(input.facilityId, db);
  if (!facility) return null;

  const start = parseTime(input.startTime);
  const end = parseTime(input.endTime);
  const ranges: TimeRange[] = Array.from({ length: input.weeks * 7 }, (_, index) => addDays(input.startDate, index))
    .filter((date) => input.daysOfWeek.includes(dayOfWeek(date)))
    .map((date) => ({ date, start, end }));

  const clashes = await scheduleService.findConflicts(db, {
    ranges,
    facility: { id: facility.id, exclusive: true },
    accountId: ctx.buyer.kind === 'MEMBER' ? ctx.buyer.accountId : undefined,
    planned: ctx.planned.flatMap(({ uses }) => uses),
    now: ctx.now,
  });
  const sessions = ranges.map((range) => {
    const clash: ScheduleClashReason | undefined =
      clashes.find(({ date }) => date === range.date)?.reason ??
      (busyInOrder(ctx, [range]) ? 'MEMBER_BUSY' : undefined);
    return { ...range, clash };
  });
  return { facility, sessions };
};

export const facilityPackageHandler: LineHandler<PackageInput, PackageData, FacilityPackageSnapshot> = {
  type: 'FACILITY_PACKAGE',
  guestAllowed: false,
  needsScheduleLock: true,

  lockTargets: (input) => ({ facilities: [input.facilityId] }),

  prepare: async (db, ctx, input) => {
    const plan = await planPackage(db, ctx, input);
    if (!plan) return lineError(ERROR_CODE.NOT_FOUND, 'Cơ sở không tồn tại');
    const { facility, sessions } = plan;

    const clashed = sessions.find(({ clash }) => clash);
    if (clashed?.clash) {
      return lineError(
        ERROR_CODE.SCHEDULE_CONFLICT,
        `Buổi ${formatCenterDate(clashed.date)}: ${CLASH_MESSAGE[clashed.clash]}`,
      );
    }

    const first = sessions[0]!;
    const last = sessions.at(-1)!;
    const slotsPerSession = (first.end - first.start) / ctx.settings.slotDurationMinutes;
    const priced = await priceBookings(
      db,
      ctx,
      facility,
      sessions.map(({ date }) => ({ date, slots: slotsPerSession })),
    );
    const unitPrice = Number(facility.pricePerSlot);
    const daysOfWeek = [...input.daysOfWeek].sort();

    return {
      ok: true,
      subtotal: priced.reduce((sum, { subtotal }) => sum + subtotal, 0),
      membershipDiscount: priced.reduce((sum, { discount }) => sum + discount, 0),
      snapshot: {
        title: `${facility.name} · ${daysOfWeek.map((day) => DAY_LABELS[day]).join(', ')}`,
        startAt: toCenterDateTime(first.date, first.start).toISOString(),
        endAt: toCenterDateTime(last.date, last.end).toISOString(),
        discountPct: ctx.benefits?.current?.bookingDiscountPct ?? 0,
        facilityName: facility.name,
        sportNames: facility.sports.map(({ sport }) => sport.name),
        startDate: first.date,
        endDate: last.date,
        daysOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        weeks: input.weeks,
        sessions: sessions.length,
        slotsPerSession,
        pricePerSlot: unitPrice,
        freeSessions: priced.filter(({ benefit }) => benefit === 'FREE_SLOT' || benefit === 'GYM_ACCESS').length,
      },
      data: {
        facilityId: facility.id,
        startDate: first.date,
        endDate: last.date,
        daysOfWeek,
        start: first.start,
        end: first.end,
        unitPrice,
        bookings: priced.map(({ date, slots, benefit }) => ({ date, slots, benefit })),
      },
      uses: sessions.map(({ date, start, end }): PlannedUse => ({
        date,
        start,
        end,
        facilityId: facility.id,
        exclusive: true,
      })),
    };
  },

  verify: async (tx, _ctx, { data }) => {
    const dates = data.bookings.map(({ date }) => date);
    const [facility, , , maintenances] = await scheduleRepository.findFacilityUsage(data.facilityId, dates, tx);
    if (!facility || facility.deletedAt || !facility.isActive) {
      return { code: ERROR_CODE.SCHEDULE_CONFLICT, message: CLASH_MESSAGE.CLOSED };
    }
    const blocked = dates.some((date) => {
      const startAt = toCenterDateTime(date, data.start);
      const endAt = toCenterDateTime(date, data.end);
      return maintenances.some((item) => item.startAt < endAt && startAt < item.endAt);
    });
    return blocked ? { code: ERROR_CODE.SCHEDULE_CONFLICT, message: CLASH_MESSAGE.MAINTENANCE } : null;
  },

  fulfill: async (tx, ctx, { data }, orderItemId) => {
    if (ctx.buyer.kind !== 'MEMBER') throw new Error('Facility package requires a member buyer');
    const accountId = ctx.buyer.accountId;
    const facilityPackage = await bookingRepository.createPackage(
      {
        accountId,
        facilityId: data.facilityId,
        orderItemId,
        daysOfWeek: data.daysOfWeek,
        startTime: toDbTime(data.start),
        endTime: toDbTime(data.end),
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        unitPrice: data.unitPrice,
        bookings: {
          create: data.bookings.map(({ date, benefit }) => ({
            facilityId: data.facilityId,
            accountId,
            orderItemId,
            bookingDate: new Date(date),
            startTime: toDbTime(data.start),
            endTime: toDbTime(data.end),
            unitPrice: data.unitPrice,
            benefit,
          })),
        },
      },
      tx,
    );
    return { refId: facilityPackage.id };
  },
};
