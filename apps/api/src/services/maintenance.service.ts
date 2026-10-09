import { ERROR_CODE, type ListMaintenancesQuery, type MaintenanceWindow, type Ref } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Prisma } from '~/generated/prisma/client';
import {
  toAffectedBookingResponse,
  toAffectedSessionResponse,
  toMaintenanceResponse,
} from '~/mappers/maintenance.mapper';
import facilityRepository from '~/repositories/facility.repository';
import maintenanceRepository from '~/repositories/maintenance.repository';
import { ErrorWithStatus } from '~/rules/error';
import scheduleService, { type TimeRange } from '~/services/schedule.service';
import { formatDate, fromDbTime, toCenterDateTime } from '~/utils/time';

const notFound = () =>
  new ErrorWithStatus({ status: HTTP_STATUS.NOT_FOUND, code: ERROR_CODE.NOT_FOUND, message: 'Không tìm thấy cơ sở' });

const rangeOf = (row: { sessionDate?: Date; bookingDate?: Date; startTime: Date; endTime: Date }): TimeRange => ({
  date: formatDate((row.sessionDate ?? row.bookingDate)!),
  start: fromDbTime(row.startTime),
  end: fromDbTime(row.endTime),
});

const insideWindow = (range: TimeRange, startAt: Date, endAt: Date, now: Date) => {
  const from = toCenterDateTime(range.date, range.start);
  return from >= now && from < endAt && startAt < toCenterDateTime(range.date, range.end);
};

const freeFacilities = async (
  tx: Prisma.TransactionClient,
  candidates: Ref[],
  range: TimeRange,
  exclusive: boolean,
  now: Date,
) => {
  const results = await Promise.all(
    candidates.map(async (facility) => {
      const conflicts = await scheduleService.findConflicts(tx, {
        ranges: [range],
        facility: { id: facility.id, exclusive },
        now,
      });
      return conflicts.length === 0 ? facility : null;
    }),
  );
  return results.filter((facility): facility is Ref => facility !== null);
};

class MaintenanceService {
  list = async (query: ListMaintenancesQuery) =>
    (await maintenanceRepository.findMany(query)).map(toMaintenanceResponse);

  affected = async (
    { facilityId, startAt: start, endAt: end }: MaintenanceWindow,
    tx: Prisma.TransactionClient = prisma,
    now = new Date(),
  ) => {
    const facility = await facilityRepository.findById(facilityId, tx);
    if (!facility) throw notFound();
    const startAt = new Date(start);
    const endAt = new Date(end);
    const [bookings, sessions, sportIds] = await Promise.all([
      maintenanceRepository.findBookingsBetween(facilityId, startAt, endAt, tx),
      maintenanceRepository.findSessionsBetween(facilityId, startAt, endAt, tx),
      facilityRepository.findSportIds(facilityId, tx),
    ]);
    const candidates = await maintenanceRepository.findFacilitiesForSports(
      [...new Set([...sportIds, ...sessions.map((session) => session.class.course.sportId)])],
      facilityId,
      tx,
    );
    const sharing = (ids: string[]) =>
      candidates
        .filter((candidate) => candidate.sports.some(({ sportId }) => ids.includes(sportId)))
        .map(({ id, name }) => ({ id, name }));

    const affectedBookings = await Promise.all(
      bookings
        .filter((booking) => insideWindow(rangeOf(booking), startAt, endAt, now))
        .map(async (booking) => ({
          row: booking,
          alternatives: await freeFacilities(tx, sharing(sportIds), rangeOf(booking), false, now),
        })),
    );
    const affectedSessions = await Promise.all(
      sessions
        .filter((session) => insideWindow(rangeOf(session), startAt, endAt, now))
        .map(async (session) => ({
          row: session,
          alternatives: await freeFacilities(tx, sharing([session.class.course.sportId]), rangeOf(session), true, now),
        })),
    );
    return { affectedBookings, affectedSessions };
  };

  preview = async (window: MaintenanceWindow) => {
    const { affectedBookings, affectedSessions } = await this.affected(window);
    return {
      affectedBookings: affectedBookings.map(({ row, alternatives }) => toAffectedBookingResponse(row, alternatives)),
      affectedSessions: affectedSessions.map(({ row, alternatives }) => toAffectedSessionResponse(row, alternatives)),
    };
  };
}

export default new MaintenanceService();
