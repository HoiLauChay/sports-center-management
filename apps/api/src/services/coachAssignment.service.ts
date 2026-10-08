import { ERROR_CODE, type AssignCoachBody } from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Prisma } from '~/generated/prisma/client';
import { toClassDetailResponse } from '~/mappers/class.mapper';
import { toCoachRegistrationResponse } from '~/mappers/coachRegistration.mapper';
import accountRepository from '~/repositories/account.repository';
import classRepository, { type ClassDetailRow } from '~/repositories/class.repository';
import registrationRepository from '~/repositories/coachRegistration.repository';
import enrollmentRepository from '~/repositories/enrollment.repository';
import specializationRepository from '~/repositories/specialization.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import notificationService from '~/services/notification.service';
import scheduleService from '~/services/schedule.service';
import { formatDate, fromDbTime, toCenterDateTime, todayInCenter } from '~/utils/time';
import { lockRows, runTransaction, withScheduleLock } from '~/utils/transaction';

const invalidState = (message: string) =>
  new ErrorWithStatus({ status: HTTP_STATUS.CONFLICT, code: ERROR_CODE.INVALID_STATE, message });
const forbidden = (message: string) =>
  new ErrorWithStatus({ status: HTTP_STATUS.FORBIDDEN, code: ERROR_CODE.FORBIDDEN, message });
const notFound = (message = 'Không tìm thấy lớp học') =>
  new ErrorWithStatus({ status: HTTP_STATUS.NOT_FOUND, code: ERROR_CODE.NOT_FOUND, message });

const requireClass = async (id: string, tx: Prisma.TransactionClient) => {
  const current = await classRepository.findDetail(id, tx);
  if (!current) throw notFound();
  return current;
};

const pickCoach = async (classId: string, body: AssignCoachBody, tx: Prisma.TransactionClient) => {
  if ('coachId' in body) return { coachId: body.coachId, registrationId: null };
  const registration = await registrationRepository.findInClass(body.registrationId, classId, tx);
  if (!registration) throw notFound('Không tìm thấy đăng ký của lớp');
  return { coachId: registration.coachId, registrationId: registration.id };
};

const sessionsOf = (current: ClassDetailRow) => current.sessions.filter(({ status }) => status === 'SCHEDULED');
const assertNotStarted = (current: ClassDetailRow) => {
  const sessions = sessionsOf(current);
  if (!sessions.length || sessions.some(({ sessionDate }) => formatDate(sessionDate) <= todayInCenter())) {
    throw invalidState('Lớp phải có buổi học và chưa đến ngày bắt đầu');
  }
};
const assertQualifiedAndAvailable = async (current: ClassDetailRow, coachId: string, tx: Prisma.TransactionClient) => {
  if (!(await specializationRepository.isQualified(coachId, current.course.sportId, tx))) {
    throw forbidden('Huấn luyện viên không hoạt động hoặc chưa được duyệt bộ môn');
  }
  const now = new Date();
  const sessions = sessionsOf(current).filter(
    ({ sessionDate, endTime }) => toCenterDateTime(formatDate(sessionDate), fromDbTime(endTime)) > now,
  );
  await scheduleService.assertAvailable(tx, {
    coachId,
    ignoreSessionIds: current.sessions.map(({ id }) => id),
    ranges: sessions.map(({ sessionDate, startTime, endTime }) => ({
      date: formatDate(sessionDate),
      start: fromDbTime(startTime),
      end: fromDbTime(endTime),
    })),
  });
};

class CoachAssignmentService {
  list = async (classId: string) => {
    if (!(await classRepository.findDetail(classId))) throw notFound();
    return (await registrationRepository.findAll(classId)).map(toCoachRegistrationResponse);
  };

  register = async (coachId: string, classId: string, ip?: string) => {
    const registration = await runTransaction(async (tx) => {
      await withScheduleLock(tx);
      await lockRows(tx, { accounts: [coachId], classes: [classId] });
      const current = await requireClass(classId, tx);
      if (!['DRAFT', 'PENDING_APPROVAL'].includes(current.status) || current.coachId)
        throw invalidState('Chỉ đăng ký lớp nháp hoặc chờ duyệt chưa có huấn luyện viên');
      assertNotStarted(current);
      await assertQualifiedAndAvailable(current, coachId, tx);
      if (await registrationRepository.hasPending(classId, coachId, tx)) {
        throw new ErrorWithStatus({
          status: HTTP_STATUS.CONFLICT,
          code: ERROR_CODE.CONFLICT,
          message: 'Bạn đã có đăng ký chờ duyệt cho lớp này',
        });
      }
      const created = await registrationRepository.create({ classId, coachId, source: 'COACH_REGISTERED' }, tx);
      await auditService.record(
        {
          accountId: coachId,
          action: 'CREATE',
          entityType: 'CLASS_COACH_REGISTRATION',
          entityId: created.id,
          newValues: created,
          ipAddress: ip,
        },
        tx,
      );
      if (current.status === 'DRAFT') {
        const updated = await classRepository.update(classId, { status: 'PENDING_APPROVAL' }, tx);
        await auditService.record(
          {
            accountId: coachId,
            action: 'UPDATE',
            entityType: 'CLASS',
            entityId: classId,
            oldValues: current,
            newValues: updated,
            ipAddress: ip,
          },
          tx,
        );
      }
      return created;
    });
    return toCoachRegistrationResponse(registration);
  };

  assign = async (managerId: string, classId: string, body: AssignCoachBody, ip?: string) => {
    const { row, notifications } = await runTransaction(async (tx) => {
      await withScheduleLock(tx);
      const { coachId, registrationId } = await pickCoach(classId, body, tx);
      await lockRows(tx, { accounts: [coachId], classes: [classId] });
      const current = await requireClass(classId, tx);
      const pending = await registrationRepository.findPending(classId, tx);
      const selected = pending.find(({ id }) => id === registrationId);
      if (registrationId && !selected) throw invalidState('Chỉ có thể chọn đăng ký đang chờ');
      if (
        current.status === 'CANCELLED' ||
        !sessionsOf(current).length ||
        sessionsOf(current).every(({ sessionDate }) => formatDate(sessionDate) < todayInCenter())
      )
        throw invalidState('Không thể phân công lớp đã hủy, kết thúc hoặc không có buổi học');
      if (current.status !== 'OPEN') assertNotStarted(current);
      if (current.coachId === coachId) throw invalidState('Huấn luyện viên này đã được phân công');
      await assertQualifiedAndAvailable(current, coachId, tx);

      for (const registration of pending) {
        const status = registration.id === selected?.id ? 'APPROVED' : 'REJECTED';
        const updated = await registrationRepository.review(registration.id, status, managerId, tx);
        await auditService.record(
          {
            accountId: managerId,
            action: status === 'APPROVED' ? 'APPROVE' : 'REJECT',
            entityType: 'CLASS_COACH_REGISTRATION',
            entityId: registration.id,
            oldValues: registration,
            newValues: updated,
            ipAddress: ip,
          },
          tx,
        );
      }
      if (!selected) {
        const created = await registrationRepository.create(
          {
            classId,
            coachId,
            source: 'MANAGER_ASSIGNED',
            status: 'APPROVED',
            reviewedById: managerId,
            reviewedAt: new Date(),
          },
          tx,
        );
        await auditService.record(
          {
            accountId: managerId,
            action: 'CREATE',
            entityType: 'CLASS_COACH_REGISTRATION',
            entityId: created.id,
            newValues: created,
            ipAddress: ip,
          },
          tx,
        );
      }
      const row = await classRepository.update(
        classId,
        { coachId, status: current.status === 'DRAFT' ? 'PENDING_APPROVAL' : current.status },
        tx,
      );
      await auditService.record(
        {
          accountId: managerId,
          action: 'UPDATE',
          entityType: 'CLASS',
          entityId: classId,
          oldValues: current,
          newValues: row,
          ipAddress: ip,
        },
        tx,
      );
      const recipients = new Set([
        coachId,
        ...pending.filter((r) => r.id !== selected?.id).map((r) => r.coachId),
        ...(current.coachId ? [current.coachId] : []),
      ]);
      const notifications = await notificationService.create(
        [...recipients].map((accountId) => ({
          accountId,
          type: 'CLASS',
          referenceType: 'CLASS',
          referenceId: classId,
          title: 'Cập nhật phân công huấn luyện viên',
          message:
            accountId === coachId
              ? `Bạn đã được phân công dạy lớp "${current.name}".`
              : `Lớp "${current.name}" đã được phân công cho huấn luyện viên khác.`,
          sendEmail: true,
        })),
        tx,
      );
      return { row, notifications };
    });
    notificationService.sendEmailsAfterCommit(notifications);
    return toClassDetailResponse(row);
  };

  withdraw = async (coachId: string, classId: string, ip?: string) => {
    const { row, notifications } = await runTransaction(async (tx) => {
      await withScheduleLock(tx);
      await lockRows(tx, { accounts: [coachId], classes: [classId] });
      const current = await requireClass(classId, tx);
      if (current.coachId !== coachId) throw forbidden('Bạn không phải huấn luyện viên hiện tại của lớp');
      if (!['OPEN', 'PENDING_APPROVAL'].includes(current.status))
        throw invalidState('Không thể rút khỏi lớp ở trạng thái này');
      assertNotStarted(current);
      const row = await classRepository.update(
        classId,
        { coachId: null, status: 'PENDING_APPROVAL', approvedById: null, approvedAt: null },
        tx,
      );
      await auditService.record(
        {
          accountId: coachId,
          action: 'UPDATE',
          entityType: 'CLASS',
          entityId: classId,
          oldValues: current,
          newValues: row,
          ipAddress: ip,
        },
        tx,
      );
      const enrollments = await enrollmentRepository.findActiveByClass(classId, tx);
      const managerIds = await accountRepository.findActiveManagerIds(tx);
      const notifications = await notificationService.create(
        [
          ...enrollments.map(({ accountId }) => ({
            accountId,
            type: 'CLASS' as const,
            referenceType: 'CLASS',
            referenceId: classId,
            title: 'Lớp học đang tìm HLV thay thế',
            message: `Lớp "${current.name}" đang tìm HLV thay thế. Đăng ký của bạn được giữ nguyên.`,
            sendEmail: true,
          })),
          ...managerIds.map((accountId) => ({
            accountId,
            type: 'CLASS' as const,
            referenceType: 'CLASS',
            referenceId: classId,
            title: 'Lớp học cần phân công huấn luyện viên',
            message: `Huấn luyện viên đã rút khỏi lớp "${current.name}". Vui lòng phân công HLV thay thế.`,
          })),
        ],
        tx,
      );
      return { row, notifications };
    });
    notificationService.sendEmailsAfterCommit(notifications);
    return toClassDetailResponse(row);
  };
}

export default new CoachAssignmentService();
