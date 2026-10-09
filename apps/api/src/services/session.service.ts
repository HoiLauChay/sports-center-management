import { ERROR_CODE, type ListSessionsQuery, type Role, type UpdateSessionBody } from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Prisma } from '~/generated/prisma/client';
import { toSessionResponse } from '~/mappers/class.mapper';
import { toSessionDetailResponse } from '~/mappers/session.mapper';
import classRepository from '~/repositories/class.repository';
import facilityRepository from '~/repositories/facility.repository';
import sessionRepository from '~/repositories/session.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import notificationService from '~/services/notification.service';
import scheduleService from '~/services/schedule.service';
import { formatDate, formatTime, fromDbTime, parseTime, toCenterDateTime, toDbTime, todayInCenter } from '~/utils/time';
import { lockRows, runTransaction, withScheduleLock } from '~/utils/transaction';

const notFound = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.NOT_FOUND,
    code: ERROR_CODE.NOT_FOUND,
    message: 'Không tìm thấy buổi học',
  });
const invalid = (field: keyof UpdateSessionBody, message: string) =>
  new ErrorWithStatus({
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    code: ERROR_CODE.VALIDATION,
    message: 'Dữ liệu không hợp lệ',
    errors: [{ path: `body.${field}`, message }],
  });
const forbidden = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.FORBIDDEN,
    code: ERROR_CODE.FORBIDDEN,
    message: 'Bạn không phụ trách lớp của buổi học này',
  });

class SessionService {
  get = async (actor: { id: string; role: Role }, id: string) => {
    const row = await sessionRepository.findDetail(id);
    if (!row) throw notFound();
    if (actor.role === 'COACH' && row.class.coachId !== actor.id) throw forbidden();
    return toSessionDetailResponse(row);
  };

  listOn = async ({ date = todayInCenter() }: ListSessionsQuery) =>
    (await sessionRepository.findOn(date)).map(toSessionDetailResponse);

  update = async (managerId: string, id: string, body: UpdateSessionBody, ip?: string) => {
    const { row, notifications } = await runTransaction(async (tx) => {
      await withScheduleLock(tx);
      return this.rescheduleLocked(tx, managerId, id, body, ip);
    });
    notificationService.sendEmailsAfterCommit(notifications);
    return toSessionResponse(row);
  };

  rescheduleLocked = async (
    tx: Prisma.TransactionClient,
    managerId: string,
    id: string,
    body: UpdateSessionBody,
    ip?: string,
  ) => {
    const found = await sessionRepository.findById(id, tx);
    if (!found) throw notFound();
    await lockRows(tx, { classes: [found.classId] });
    const current = await sessionRepository.findById(id, tx);
    if (!current) throw notFound();
    const cls = current.class;
    const now = new Date();
    if (
      cls.status === 'CANCELLED' ||
      current.status !== 'SCHEDULED' ||
      toCenterDateTime(formatDate(current.sessionDate), fromDbTime(current.startTime)) <= now
    ) {
      throw new ErrorWithStatus({
        status: HTTP_STATUS.CONFLICT,
        code: ERROR_CODE.INVALID_STATE,
        message: 'Chỉ được sửa buổi chưa diễn ra và chưa bị hủy',
      });
    }

    const date = body.date ?? formatDate(current.sessionDate);
    const start = body.startTime === undefined ? fromDbTime(current.startTime) : parseTime(body.startTime);
    const end = body.endTime === undefined ? fromDbTime(current.endTime) : parseTime(body.endTime);
    const facilityId = body.facilityId ?? current.facilityId;
    if (start >= end) throw invalid('endTime', 'Giờ kết thúc phải sau giờ bắt đầu');

    const facility = await facilityRepository.findById(facilityId, tx);
    if (!facility?.isActive) throw invalid('facilityId', 'Cơ sở không tồn tại hoặc đã ngừng hoạt động');
    if (!facility.sports.some(({ sport }) => sport.id === cls.course.sportId)) {
      throw invalid('facilityId', 'Cơ sở không hỗ trợ bộ môn của khóa học');
    }
    await scheduleService.assertAvailable(tx, {
      ranges: [{ date, start, end }],
      facility: { id: facilityId, exclusive: true },
      coachId: cls.coachId ?? undefined,
      accountIds: cls.enrollments.map(({ accountId }) => accountId),
      ignoreSessionIds: [id],
      now,
    });

    if (
      date === formatDate(current.sessionDate) &&
      start === fromDbTime(current.startTime) &&
      end === fromDbTime(current.endTime) &&
      facilityId === current.facilityId
    ) {
      return { row: { ...current, facility: { id: facility.id, name: facility.name } }, notifications: [] };
    }

    const row = await sessionRepository.update(
      id,
      {
        sessionDate: new Date(date),
        startTime: toDbTime(start),
        endTime: toDbTime(end),
        facilityId,
      },
      tx,
    );
    const bounds = await sessionRepository.dateBounds(cls.id, tx);
    const dates = { startDate: bounds._min.sessionDate, endDate: bounds._max.sessionDate };
    await classRepository.update(cls.id, dates, tx);
    await auditService.record(
      {
        accountId: managerId,
        action: 'UPDATE',
        entityType: 'CLASS_SESSION',
        entityId: id,
        oldValues: current,
        newValues: row,
        ipAddress: ip,
      },
      tx,
    );
    if (
      cls.startDate?.getTime() !== dates.startDate?.getTime() ||
      cls.endDate?.getTime() !== dates.endDate?.getTime()
    ) {
      await auditService.record(
        {
          accountId: managerId,
          action: 'UPDATE',
          entityType: 'CLASS',
          entityId: cls.id,
          oldValues: cls,
          newValues: { ...cls, ...dates },
          ipAddress: ip,
        },
        tx,
      );
    }
    const recipients = [
      ...new Set([...(cls.coachId ? [cls.coachId] : []), ...cls.enrollments.map(({ accountId }) => accountId)]),
    ];
    const notifications = await notificationService.create(
      recipients.map((accountId) => ({
        accountId,
        type: 'CLASS',
        title: 'Lịch buổi học đã thay đổi',
        message: `Buổi ${current.sessionNumber} lớp "${cls.name}" đổi từ ${formatDate(current.sessionDate)} ${formatTime(fromDbTime(current.startTime))}–${formatTime(fromDbTime(current.endTime))} sang ${date} ${formatTime(start)}–${formatTime(end)}, tại ${facility.name}.`,
        referenceType: 'CLASS',
        referenceId: cls.id,
        sendEmail: true,
      })),
      tx,
    );
    return { row, notifications };
  };
}

export default new SessionService();
