import { ERROR_CODE, type CancelEnrollmentResult, type MyEnrollment } from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Role } from '~/generated/prisma/client';
import { toClassSummaryResponse } from '~/mappers/class.mapper';
import { toEnrollmentResponse } from '~/mappers/enrollment.mapper';
import classRepository from '~/repositories/class.repository';
import enrollmentRepository from '~/repositories/enrollment.repository';
import { ErrorWithStatus } from '~/rules/error';
import notificationService, { type CreatedNotification } from '~/services/notification.service';
import refundService from '~/services/refund.service';
import { formatDate, todayInCenter } from '~/utils/time';
import { lockRows, runTransaction, withScheduleLock } from '~/utils/transaction';

interface Actor {
  id: string;
  role: Role;
}

const notFound = () =>
  new ErrorWithStatus({ status: HTTP_STATUS.NOT_FOUND, code: ERROR_CODE.NOT_FOUND, message: 'Không tìm thấy đăng ký' });

const invalidState = (message: string) =>
  new ErrorWithStatus({ status: HTTP_STATUS.CONFLICT, code: ERROR_CODE.INVALID_STATE, message });

class EnrollmentService {
  listMine = async (accountId: string): Promise<MyEnrollment[]> =>
    (await enrollmentRepository.findByAccount(accountId)).map((row) => ({
      ...toEnrollmentResponse(row),
      class: toClassSummaryResponse(row.class),
    }));

  listForClass = async (actor: Actor, classId: string) => {
    const cls = await classRepository.findDetail(classId);
    if (!cls)
      throw new ErrorWithStatus({
        status: HTTP_STATUS.NOT_FOUND,
        code: ERROR_CODE.NOT_FOUND,
        message: 'Không tìm thấy lớp học',
      });
    if (actor.role === 'COACH' && cls.coachId !== actor.id) {
      throw new ErrorWithStatus({
        status: HTTP_STATUS.FORBIDDEN,
        code: ERROR_CODE.FORBIDDEN,
        message: 'Bạn chỉ được xem học viên lớp mình phụ trách',
      });
    }
    // A coach only sees the students still in the class; staff also see who left.
    const status = actor.role === 'COACH' ? 'ENROLLED' : undefined;
    return (await enrollmentRepository.findByClass(classId, status)).map(toEnrollmentResponse);
  };

  cancel = async (actor: Actor, id: string): Promise<CancelEnrollmentResult> => {
    const found = await enrollmentRepository.findById(id);
    if (!found || (actor.role === 'MEMBER' && found.accountId !== actor.id)) throw notFound();
    let notifications: CreatedNotification[] = [];

    const result = await runTransaction(async (tx) => {
      await withScheduleLock(tx);
      await lockRows(tx, {
        accounts: [found.accountId],
        memberProfiles: [found.accountId],
        classes: [found.classId],
      });

      const enrollment = (await enrollmentRepository.findById(id, tx))!;
      if (enrollment.status !== 'ENROLLED') throw invalidState('Đăng ký đã được hủy');
      const { startDate } = enrollment.class;
      if (!startDate || formatDate(startDate) <= todayInCenter()) {
        throw invalidState('Lớp đã khai giảng, không thể hủy đăng ký');
      }

      await enrollmentRepository.cancel(id, tx);
      const refund = await refundService.refundItem(tx, {
        orderItemId: enrollment.orderItemId,
        reason: `Hủy đăng ký lớp ${enrollment.class.name}`,
        createdById: actor.role === 'MEMBER' ? undefined : actor.id,
      });
      notifications = refund.notifications;
      return {
        enrollment: toEnrollmentResponse((await enrollmentRepository.findById(id, tx))!),
        refund: refund.refunded,
      };
    });

    notificationService.sendEmailsAfterCommit(notifications);
    return result;
  };
}

export default new EnrollmentService();
