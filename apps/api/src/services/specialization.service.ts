import { ERROR_CODE, type ReviewSpecializationBody } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import { HTTP_STATUS } from '~/constants/httpStatus';
import { toSpecializationResponse } from '~/mappers/specialization.mapper';
import specializationRepository from '~/repositories/specialization.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import notificationService from '~/services/notification.service';
import { runTransaction } from '~/utils/transaction';

const notFound = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.NOT_FOUND,
    code: ERROR_CODE.NOT_FOUND,
    message: 'Không tìm thấy đăng ký chuyên môn',
  });

class SpecializationService {
  listForCoach = async (coachId: string) => {
    const rows = await specializationRepository.findAll(coachId);
    return rows.map(toSpecializationResponse);
  };

  listForManager = async () => {
    const rows = await specializationRepository.findAll();
    return rows.map(toSpecializationResponse);
  };

  register = async (coachId: string, sportId: string, ip?: string) => {
    const sport = await prisma.sport.findUnique({
      where: { id: sportId },
      select: { id: true, isActive: true, deletedAt: true },
    });
    if (!sport || sport.deletedAt) {
      throw new ErrorWithStatus({
        status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
        code: ERROR_CODE.VALIDATION,
        message: 'Bộ môn không tồn tại',
      });
    }
    if (!sport.isActive) {
      throw new ErrorWithStatus({
        status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
        code: ERROR_CODE.VALIDATION,
        message: 'Bộ môn đã ngừng hoạt động',
      });
    }

    const specialization = await runTransaction(async (tx) => {
      const existing = await specializationRepository.findExisting(coachId, sportId, tx);
      if (existing) {
        throw new ErrorWithStatus({
          status: HTTP_STATUS.CONFLICT,
          code: ERROR_CODE.DUPLICATE_REQUEST,
          message: 'Bạn đã đăng ký bộ môn này rồi',
        });
      }

      const created = await specializationRepository.create(coachId, sportId, tx);
      await auditService.record(
        {
          accountId: coachId,
          action: 'CREATE',
          entityType: 'COACH_SPECIALIZATION',
          entityId: created.id,
          newValues: created,
          ipAddress: ip,
        },
        tx,
      );
      return created;
    });
    return toSpecializationResponse(specialization);
  };

  approve = async (managerId: string, id: string, body: ReviewSpecializationBody, ip?: string) =>
    this.review(managerId, id, 'APPROVED', body, ip);

  reject = async (managerId: string, id: string, body: ReviewSpecializationBody, ip?: string) =>
    this.review(managerId, id, 'REJECTED', body, ip);

  private review = async (
    managerId: string,
    id: string,
    status: 'APPROVED' | 'REJECTED',
    body: ReviewSpecializationBody,
    ip?: string,
  ) => {
    const { specialization, notifications } = await runTransaction(async (tx) => {
      const current = await specializationRepository.findById(id, tx);
      if (!current) throw notFound();

      if (current.status !== 'PENDING') {
        throw new ErrorWithStatus({
          status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
          code: ERROR_CODE.VALIDATION,
          message: 'Chỉ có thể duyệt đăng ký ở trạng thái chờ',
        });
      }

      const updated = await specializationRepository.review(
        id,
        { status, reviewNote: body.reviewNote, reviewedById: managerId },
        tx,
      );
      await auditService.record(
        {
          accountId: managerId,
          action: 'UPDATE',
          entityType: 'COACH_SPECIALIZATION',
          entityId: id,
          oldValues: current,
          newValues: updated,
          ipAddress: ip,
        },
        tx,
      );

      const statusText = status === 'APPROVED' ? 'được duyệt' : 'bị từ chối';
      const notifications = await notificationService.create(
        [
          {
            accountId: current.coachId,
            type: 'SYSTEM' as const,
            title: `Đăng ký chuyên môn đã ${statusText}`,
            message: `Đăng ký bộ môn "${current.sport.name}" đã ${statusText}.${body.reviewNote ? ` Ghi chú: ${body.reviewNote}` : ''}`,
            sendEmail: true,
          },
        ],
        tx,
      );
      return { specialization: updated, notifications };
    });

    notificationService.sendEmailsAfterCommit(notifications);
    return toSpecializationResponse(specialization);
  };
}

export default new SpecializationService();
