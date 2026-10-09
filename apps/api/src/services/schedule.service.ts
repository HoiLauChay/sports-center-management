import {
  ERROR_CODE,
  type FacilitySchedule,
  type FacilitySlot,
  type ScheduleClash,
  type ScheduleClashReason,
} from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Prisma } from '~/generated/prisma/client';
import scheduleRepository, { type SessionUsage } from '~/repositories/schedule.repository';
import settingRepository from '~/repositories/setting.repository';
import { ErrorWithStatus } from '~/rules/error';
import {
  formatDate,
  formatTime,
  fromDbTime,
  generateSlots,
  isOnSlotGrid,
  overlaps,
  toCenterDateTime,
} from '~/utils/time';

export interface TimeRange {
  date: string;
  start: number;
  end: number;
}

export interface PlannedUse extends TimeRange {
  facilityId: string;
  exclusive: boolean;
}

export interface ConflictQuery {
  ranges: TimeRange[];
  facility?: { id: string; exclusive: boolean };
  coachId?: string;
  accountId?: string;
  accountIds?: string[];
  ignoreSessionIds?: string[];
  planned?: PlannedUse[];
  now?: Date;
}

interface Timed {
  date: string;
  start: number;
  end: number;
}

const timed = (date: Date, startTime: Date, endTime: Date): Timed => ({
  date: formatDate(date),
  start: fromDbTime(startTime),
  end: fromDbTime(endTime),
});

const sameDayOverlap = (range: TimeRange, other: Timed) => range.date === other.date && overlaps(range, other);

const clashOf = (range: TimeRange, reason: ScheduleClashReason, extra: Partial<ScheduleClash> = {}): ScheduleClash => ({
  date: range.date,
  startTime: formatTime(range.start),
  endTime: formatTime(range.end),
  reason,
  ...extra,
});

const sessionRef = (session: SessionUsage) => ({
  id: session.id,
  classId: session.class.id,
  className: session.class.name,
});

export const scheduleConflict = (conflicts: ScheduleClash[]) =>
  new ErrorWithStatus({
    status: HTTP_STATUS.CONFLICT,
    code: ERROR_CODE.SCHEDULE_CONFLICT,
    message: 'Lịch bị trùng hoặc không còn chỗ',
    meta: { conflicts },
  });

const facilityClashes = async (tx: Prisma.TransactionClient, query: ConflictQuery, now: Date) => {
  const { id, exclusive } = query.facility!;
  const dates = [...new Set(query.ranges.map(({ date }) => date))];
  const [[facility, bookings, sessions, maintenances], settings] = await Promise.all([
    scheduleRepository.findFacilityUsage(id, dates, tx),
    settingRepository.get(tx),
  ]);
  const grid = {
    open: fromDbTime(settings.openTime),
    close: fromDbTime(settings.closeTime),
    slot: settings.slotDurationMinutes,
  };
  const ignored = new Set(query.ignoreSessionIds);
  const liveSessions = sessions.filter((session) => !ignored.has(session.id));
  const planned = (query.planned ?? []).filter(({ facilityId }) => facilityId === id);
  const bookingUses = [
    ...bookings.map((booking) => ({
      id: booking.id,
      ...timed(booking.bookingDate, booking.startTime, booking.endTime),
    })),
    ...planned.filter((use) => !use.exclusive).map((use) => ({ id: undefined, ...use })),
  ];

  return query.ranges.flatMap((range): ScheduleClash[] => {
    if (!facility || facility.deletedAt || !facility.isActive) return [clashOf(range, 'CLOSED')];
    if (toCenterDateTime(range.date, range.start) < now) return [clashOf(range, 'PAST')];
    if (!isOnSlotGrid(range, grid.open, grid.close, grid.slot)) return [clashOf(range, 'OFF_GRID')];

    const startAt = toCenterDateTime(range.date, range.start);
    const endAt = toCenterDateTime(range.date, range.end);
    const clashes = maintenances
      .filter((maintenance) => maintenance.startAt < endAt && startAt < maintenance.endAt)
      .map((maintenance) =>
        clashOf(range, 'MAINTENANCE', { maintenance: { id: maintenance.id, reason: maintenance.reason } }),
      );

    for (const session of liveSessions) {
      if (sameDayOverlap(range, timed(session.sessionDate, session.startTime, session.endTime))) {
        clashes.push(clashOf(range, 'CLASS_SESSION', { classSession: sessionRef(session) }));
      }
    }
    if (planned.some((use) => use.exclusive && sameDayOverlap(range, use)))
      clashes.push(clashOf(range, 'CLASS_SESSION'));

    const overlapping = bookingUses.filter((use) => sameDayOverlap(range, use));
    if (exclusive) {
      clashes.push(...overlapping.map((use) => clashOf(range, 'BOOKED', use.id ? { bookingId: use.id } : {})));
    } else {
      for (let start = range.start; start < range.end; start += grid.slot) {
        const slot = { date: range.date, start, end: start + grid.slot };
        if (overlapping.filter((use) => overlaps(slot, use)).length >= facility.capacityPerSlot) {
          clashes.push(clashOf(slot, 'FULL'));
        }
      }
    }
    return clashes;
  });
};

const personClashes = async (tx: Prisma.TransactionClient, query: ConflictQuery) => {
  const dates = [...new Set(query.ranges.map(({ date }) => date))];
  const ignored = new Set(query.ignoreSessionIds);
  const clashes: ScheduleClash[] = [];

  if (query.coachId) {
    const sessions = (await scheduleRepository.findCoachSessions(query.coachId, dates, tx)).filter(
      (session) => !ignored.has(session.id),
    );
    for (const range of query.ranges) {
      for (const session of sessions) {
        if (sameDayOverlap(range, timed(session.sessionDate, session.startTime, session.endTime))) {
          clashes.push(clashOf(range, 'COACH_BUSY', { classSession: sessionRef(session) }));
        }
      }
    }
  }

  const accountIds = [...new Set([...(query.accountIds ?? []), ...(query.accountId ? [query.accountId] : [])])];
  if (accountIds.length > 0) {
    const [bookings, sessions] = await scheduleRepository.findMemberCommitments(accountIds, dates, tx);
    for (const range of query.ranges) {
      for (const booking of bookings) {
        if (sameDayOverlap(range, timed(booking.bookingDate, booking.startTime, booking.endTime))) {
          clashes.push(clashOf(range, 'MEMBER_BUSY', { bookingId: booking.id }));
        }
      }
      for (const session of sessions.filter(({ id }) => !ignored.has(id))) {
        if (sameDayOverlap(range, timed(session.sessionDate, session.startTime, session.endTime))) {
          clashes.push(clashOf(range, 'MEMBER_BUSY', { classSession: sessionRef(session) }));
        }
      }
    }
  }
  return clashes;
};

class ScheduleService {
  findConflicts = async (tx: Prisma.TransactionClient, query: ConflictQuery) => {
    if (query.ranges.length === 0) return [];
    const now = query.now ?? new Date();
    const [facility, people] = await Promise.all([
      query.facility ? facilityClashes(tx, query, now) : [],
      personClashes(tx, query),
    ]);
    return [...facility, ...people];
  };

  facilityDay = async (facilityId: string, date: string, now = new Date()): Promise<FacilitySchedule | null> => {
    const [[facility, bookings, sessions, maintenances], settings] = await Promise.all([
      scheduleRepository.findFacilityUsage(facilityId, [date]),
      settingRepository.get(),
    ]);
    if (!facility || facility.deletedAt) return null;

    const bookingTimes = bookings.map((booking) => timed(booking.bookingDate, booking.startTime, booking.endTime));
    const slots = generateSlots(
      fromDbTime(settings.openTime),
      fromDbTime(settings.closeTime),
      settings.slotDurationMinutes,
    ).map(({ start, end }): FacilitySlot => {
      const range = { date, start, end };
      const base = {
        startTime: formatTime(start),
        endTime: formatTime(end),
        booked: bookingTimes.filter((booking) => sameDayOverlap(range, booking)).length,
        capacity: facility.capacityPerSlot,
      };
      if (!facility.isActive || toCenterDateTime(date, start) < now) return { ...base, status: 'CLOSED' };

      const startAt = toCenterDateTime(date, start);
      const endAt = toCenterDateTime(date, end);
      const maintenance = maintenances.find((item) => item.startAt < endAt && startAt < item.endAt);
      if (maintenance) {
        return { ...base, status: 'MAINTENANCE', maintenance: { id: maintenance.id, reason: maintenance.reason } };
      }
      const session = sessions.find((item) =>
        sameDayOverlap(range, timed(item.sessionDate, item.startTime, item.endTime)),
      );
      if (session) {
        return { ...base, status: 'CLASS', classSession: { classId: session.class.id, className: session.class.name } };
      }
      const status = base.booked < base.capacity ? 'AVAILABLE' : 'FULL';
      return { ...base, status };
    });
    return {
      facility: { id: facility.id, name: facility.name, capacityPerSlot: facility.capacityPerSlot },
      date,
      slots,
    };
  };

  assertAvailable = async (tx: Prisma.TransactionClient, query: ConflictQuery) => {
    const conflicts = await this.findConflicts(tx, query);
    if (conflicts.length > 0) throw scheduleConflict(conflicts);
  };
}

export default new ScheduleService();
