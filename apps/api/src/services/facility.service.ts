import {
  ERROR_CODE,
  type CreateFacilityBody,
  type ListFacilitiesQuery,
  type UpdateFacilityBody,
} from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Prisma } from '~/generated/prisma/client';
import { toFacilityResponse } from '~/mappers/facility.mapper';
import { toBookingConflict, toSessionConflict } from '~/mappers/schedule.mapper';
import facilityRepository, { type FacilityRow } from '~/repositories/facility.repository';
import scheduleRepository from '~/repositories/schedule.repository';
import sportRepository from '~/repositories/sport.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import scheduleService from '~/services/schedule.service';
import { isUniqueViolation } from '~/utils/dbError';
import { runTransaction, withScheduleLock } from '~/utils/transaction';

const notFound = () =>
  new ErrorWithStatus({ status: HTTP_STATUS.NOT_FOUND, code: ERROR_CODE.NOT_FOUND, message: 'Không tìm thấy cơ sở' });

const nameTaken = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.CONFLICT,
    code: ERROR_CODE.NAME_TAKEN,
    message: 'Tên cơ sở đã tồn tại',
    errors: [{ path: 'body.name', message: 'Tên cơ sở đã tồn tại' }],
  });

const inactiveSports = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    code: ERROR_CODE.VALIDATION,
    message: 'Dữ liệu không hợp lệ',
    errors: [{ path: 'body.sportIds', message: 'Có bộ môn không tồn tại hoặc đã ngừng hoạt động' }],
  });

const assertActiveSports = async (ids: string[], tx: Prisma.TransactionClient) => {
  if (ids.length === 0) return;
  if ((await sportRepository.findActiveIds(ids, tx)).length !== ids.length) throw inactiveSports();
};

const auditValues = (facility: FacilityRow, sportIds: string[]) => ({ ...facility, sportIds: [...sportIds].sort() });

const withNameCheck = async <T>(run: () => Promise<T>) => {
  try {
    return await run();
  } catch (err) {
    if (isUniqueViolation(err, 'uq_facilities_name')) throw nameTaken();
    throw err;
  }
};

class FacilityService {
  schedule = async (id: string, date: string) => {
    const day = await scheduleService.facilityDay(id, date);
    if (!day) throw notFound();
    return day;
  };

  list = async (query: ListFacilitiesQuery, isManager: boolean) => {
    const rows = await facilityRepository.findAll({ ...query, isActive: isManager ? query.isActive : true });
    return rows.map(toFacilityResponse);
  };

  create = async (managerId: string, { sportIds, ...body }: CreateFacilityBody, ip?: string) => {
    const facility = await withNameCheck(() =>
      runTransaction(async (tx) => {
        await assertActiveSports(sportIds, tx);
        const created = await facilityRepository.create(
          { ...body, sports: { create: sportIds.map((sportId) => ({ sport: { connect: { id: sportId } } })) } },
          tx,
        );
        await auditService.record(
          {
            accountId: managerId,
            action: 'CREATE',
            entityType: 'FACILITY',
            entityId: created.id,
            newValues: auditValues(created, sportIds),
            ipAddress: ip,
          },
          tx,
        );
        return created;
      }),
    );
    return toFacilityResponse(facility);
  };

  update = async (managerId: string, id: string, { sportIds, ...body }: UpdateFacilityBody, ip?: string) => {
    const facility = await withNameCheck(() =>
      runTransaction(async (tx) => {
        if (sportIds) await withScheduleLock(tx);

        const current = await facilityRepository.findById(id, tx);
        if (!current) throw notFound();
        const currentSportIds = await facilityRepository.findSportIds(id, tx);

        const added = sportIds?.filter((sportId) => !currentSportIds.includes(sportId)) ?? [];
        const removed = sportIds ? currentSportIds.filter((sportId) => !sportIds.includes(sportId)) : [];
        await assertActiveSports(added, tx);

        if (removed.length > 0) {
          const sessions = await scheduleRepository.findUpcomingSessions(
            { facilityId: id, class: { course: { sportId: { in: removed } } } },
            tx,
          );
          if (sessions.length > 0) {
            throw new ErrorWithStatus({
              status: HTTP_STATUS.CONFLICT,
              code: ERROR_CODE.HAS_DEPENDENCIES,
              message: 'Bộ môn cần gỡ còn buổi học sắp tới tại cơ sở này',
              meta: { sessions: sessions.map(toSessionConflict) },
            });
          }
        }

        await facilityRepository.replaceSports(id, { added, removed }, tx);
        const updated = await facilityRepository.update(id, body, tx);
        await auditService.record(
          {
            accountId: managerId,
            action: 'UPDATE',
            entityType: 'FACILITY',
            entityId: id,
            oldValues: auditValues(current, currentSportIds),
            newValues: auditValues(updated, sportIds ?? currentSportIds),
            ipAddress: ip,
          },
          tx,
        );
        return updated;
      }),
    );
    return toFacilityResponse(facility);
  };

  remove = async (managerId: string, id: string, ip?: string) => {
    await runTransaction(async (tx) => {
      await withScheduleLock(tx);

      const current = await facilityRepository.findById(id, tx);
      if (!current) throw notFound();

      const bookings = await scheduleRepository.findUpcomingBookings({ facilityId: id }, tx);
      const sessions = await scheduleRepository.findUpcomingSessions({ facilityId: id }, tx);
      if (bookings.length > 0 || sessions.length > 0) {
        throw new ErrorWithStatus({
          status: HTTP_STATUS.CONFLICT,
          code: ERROR_CODE.HAS_DEPENDENCIES,
          message: 'Cơ sở còn booking hoặc buổi học sắp tới, không thể xóa',
          meta: { bookings: bookings.map(toBookingConflict), sessions: sessions.map(toSessionConflict) },
        });
      }

      await facilityRepository.update(id, { isActive: false, deletedAt: new Date() }, tx);
      await auditService.record(
        {
          accountId: managerId,
          action: 'DELETE',
          entityType: 'FACILITY',
          entityId: id,
          oldValues: auditValues(current, await facilityRepository.findSportIds(id, tx)),
          ipAddress: ip,
        },
        tx,
      );
    });
  };
}

export default new FacilityService();
