import {
  ERROR_CODE,
  type CreateMaintenanceBody,
  type ListMaintenancesQuery,
  type MaintenanceWindow,
  type Ref,
  type UpdateMaintenanceBody,
} from '@sports-center/shared';

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
import auditService from '~/services/audit.service';
import notificationService, { type CreatedNotification } from '~/services/notification.service';
import scheduleService, { scheduleConflict, type TimeRange } from '~/services/schedule.service';
import sessionService from '~/services/session.service';
import { formatDate, formatTime, fromDbTime, toCenterDateTime } from '~/utils/time';
import { runTransaction, withScheduleLock } from '~/utils/transaction';

const notFound = (message = 'Không tìm thấy cơ sở') =>
  new ErrorWithStatus({ status: HTTP_STATUS.NOT_FOUND, code: ERROR_CODE.NOT_FOUND, message });
const invalid = (errors: { path: string; message: string }[]) =>
  new ErrorWithStatus({
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    code: ERROR_CODE.VALIDATION,
    message: 'Dữ liệu không hợp lệ',
    errors,
  });
const started = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.CONFLICT,
    code: ERROR_CODE.INVALID_STATE,
    message: 'Chỉ sửa hoặc xóa được lịch bảo trì chưa bắt đầu',
  });

type Resolutions = Pick<CreateMaintenanceBody, 'bookingMoves' | 'sessionResolutions'>;

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

  private applyLocked = async (
    tx: Prisma.TransactionClient,
    managerId: string,
    window: MaintenanceWindow,
    { bookingMoves, sessionResolutions }: Resolutions,
    existing: { id: string; old: unknown } | null,
    ip?: string,
  ) => {
    const now = new Date();
    const startAt = new Date(window.startAt);
    const endAt = new Date(window.endAt);
    if (startAt <= now) throw invalid([{ path: 'body.startAt', message: 'Thời điểm bắt đầu phải ở tương lai' }]);
    if (await maintenanceRepository.hasOverlap(window.facilityId, startAt, endAt, existing?.id, tx)) {
      throw new ErrorWithStatus({
        status: HTTP_STATUS.CONFLICT,
        code: ERROR_CODE.CONFLICT,
        message: 'Cơ sở đã có lịch bảo trì chồng thời gian',
      });
    }

    const { affectedBookings, affectedSessions } = await this.affected(window, tx, now);
    const blocked = affectedBookings.filter(({ alternatives }) => alternatives.length === 0);
    if (blocked.length > 0) {
      throw new ErrorWithStatus({
        status: HTTP_STATUS.CONFLICT,
        code: ERROR_CODE.MAINTENANCE_BLOCKED,
        message: 'Còn lượt đặt không có cơ sở thay thế',
        meta: { bookings: blocked.map(({ row, alternatives }) => toAffectedBookingResponse(row, alternatives)) },
      });
    }

    const moves = new Map(bookingMoves.map((move) => [move.bookingId, move.facilityId]));
    const resolutions = new Map(sessionResolutions.map((resolution) => [resolution.sessionId, resolution]));
    const bookingIds = new Set(affectedBookings.map(({ row }) => row.id));
    const sessionIds = new Set(affectedSessions.map(({ row }) => row.id));
    const errors = [
      ...affectedBookings
        .filter(({ row, alternatives }) => !alternatives.some(({ id }) => id === moves.get(row.id)))
        .map(({ row }) => ({
          path: 'body.bookingMoves',
          message: `Lượt đặt ${row.id} cần chuyển sang một cơ sở còn chỗ`,
        })),
      ...bookingMoves
        .filter(({ bookingId }) => !bookingIds.has(bookingId))
        .map(({ bookingId }) => ({ path: 'body.bookingMoves', message: `Lượt đặt ${bookingId} không bị ảnh hưởng` })),
      ...affectedSessions
        .filter(({ row }) => !resolutions.has(row.id))
        .map(({ row }) => ({ path: 'body.sessionResolutions', message: `Buổi học ${row.id} cần đổi phòng hoặc dời` })),
      ...sessionResolutions
        .filter(({ sessionId }) => !sessionIds.has(sessionId))
        .map(({ sessionId }) => ({
          path: 'body.sessionResolutions',
          message: `Buổi học ${sessionId} không bị ảnh hưởng`,
        })),
    ];
    if (errors.length > 0) throw invalid(errors);

    const data = { startAt, endAt, reason: window.reason };
    const maintenance = existing
      ? await maintenanceRepository.update(existing.id, data, tx)
      : await maintenanceRepository.create({ ...data, facilityId: window.facilityId, createdById: managerId }, tx);
    await auditService.record(
      {
        accountId: managerId,
        action: existing ? 'UPDATE' : 'CREATE',
        entityType: 'FACILITY_MAINTENANCE',
        entityId: maintenance.id,
        oldValues: existing?.old as Record<string, unknown> | undefined,
        newValues: { ...maintenance, facilityId: window.facilityId },
        ipAddress: ip,
      },
      tx,
    );

    const notifications: CreatedNotification[] = [];
    for (const { row } of affectedBookings) {
      const range = rangeOf(row);
      const conflicts = await scheduleService.findConflicts(tx, {
        ranges: [range],
        facility: { id: moves.get(row.id)!, exclusive: false },
        now,
      });
      if (conflicts.length > 0) throw scheduleConflict(conflicts);
      const moved = await maintenanceRepository.moveBooking(row.id, moves.get(row.id)!, tx);
      if (row.account) {
        notifications.push(
          ...(await notificationService.create(
            [
              {
                accountId: row.account.id,
                type: 'BOOKING',
                title: 'Lượt đặt đã chuyển sân',
                message: `Lượt đặt ngày ${range.date} ${formatTime(range.start)}–${formatTime(range.end)} chuyển sang ${moved.facility.name} do bảo trì. Giá và giờ giữ nguyên.`,
                referenceType: 'BOOKING',
                referenceId: row.id,
                sendEmail: true,
              },
            ],
            tx,
          )),
        );
      }
    }

    for (const resolution of sessionResolutions) {
      const body =
        resolution.action === 'MOVE_FACILITY'
          ? { facilityId: resolution.facilityId }
          : {
              date: resolution.date,
              startTime: resolution.startTime,
              endTime: resolution.endTime,
              facilityId: resolution.facilityId,
            };
      const result = await sessionService.rescheduleLocked(tx, managerId, resolution.sessionId, body, ip);
      notifications.push(...result.notifications);
    }

    return {
      result: {
        maintenance: toMaintenanceResponse(maintenance),
        movedBookings: affectedBookings.length,
        sessionsUpdated: sessionResolutions.length,
      },
      notifications,
    };
  };

  create = async (
    managerId: string,
    { bookingMoves, sessionResolutions, ...window }: CreateMaintenanceBody,
    ip?: string,
  ) => {
    const { result, notifications } = await runTransaction(async (tx) => {
      await withScheduleLock(tx);
      return this.applyLocked(tx, managerId, window, { bookingMoves, sessionResolutions }, null, ip);
    });
    notificationService.sendEmailsAfterCommit(notifications);
    return result;
  };

  update = async (
    managerId: string,
    id: string,
    { bookingMoves = [], sessionResolutions = [], ...period }: UpdateMaintenanceBody,
    ip?: string,
  ) => {
    const { result, notifications } = await runTransaction(async (tx) => {
      await withScheduleLock(tx);
      const current = await maintenanceRepository.findById(id, tx);
      if (!current) throw notFound('Không tìm thấy lịch bảo trì');
      if (current.startAt <= new Date()) throw started();
      return this.applyLocked(
        tx,
        managerId,
        { ...period, facilityId: current.facilityId },
        { bookingMoves, sessionResolutions },
        { id, old: current },
        ip,
      );
    });
    notificationService.sendEmailsAfterCommit(notifications);
    return result;
  };

  remove = async (managerId: string, id: string, ip?: string) =>
    runTransaction(async (tx) => {
      await withScheduleLock(tx);
      const current = await maintenanceRepository.findById(id, tx);
      if (!current) throw notFound('Không tìm thấy lịch bảo trì');
      if (current.startAt <= new Date()) throw started();
      const removed = await maintenanceRepository.update(id, { deletedAt: new Date() }, tx);
      await auditService.record(
        {
          accountId: managerId,
          action: 'DELETE',
          entityType: 'FACILITY_MAINTENANCE',
          entityId: id,
          oldValues: current,
          newValues: { ...removed, facilityId: current.facilityId, deletedAt: new Date() },
          ipAddress: ip,
        },
        tx,
      );
    });

  preview = async (window: MaintenanceWindow) => {
    const { affectedBookings, affectedSessions } = await this.affected(window);
    return {
      affectedBookings: affectedBookings.map(({ row, alternatives }) => toAffectedBookingResponse(row, alternatives)),
      affectedSessions: affectedSessions.map(({ row, alternatives }) => toAffectedSessionResponse(row, alternatives)),
    };
  };
}

export default new MaintenanceService();
