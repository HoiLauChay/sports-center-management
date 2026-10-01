import { ERROR_CODE, type ListSpecializationsQuery, type ReviewSpecializationBody } from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { toSpecializationResponse } from '~/mappers/specialization.mapper';
import specializationRepository from '~/repositories/specialization.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import notificationService from '~/services/notification.service';
import { isUniqueViolation } from '~/utils/dbError';
import { toPage } from '~/utils/pagination';
import { runTransaction } from '~/utils/transaction';

const notFound = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.NOT_FOUND,
    code: ERROR_CODE.NOT_FOUND,
    message: 'Không tìm thấy đăng ký chuyên môn',
  });

const invalidSport = (message: string) =>
  new ErrorWithStatus({
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    code: ERROR_CODE.VALIDATION,
    message: 'Dữ liệu không hợp lệ',
    errors: [{ path: 'body.sportId', message }],
  });

const alreadyRegistered = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.CONFLICT,
    code: ERROR_CODE.CONFLICT,
    message: 'Bạn đã đăng ký bộ môn này rồi',
  });

const notPending = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.CONFLICT,
    code: ERROR_CODE.CONFLICT,
    message: 'Chỉ có thể duyệt đăng ký ở trạng thái chờ',
  });

const sportUnavailable = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.CONFLICT,
    code: ERROR_CODE.CONFLICT,
    message: 'Bộ môn đã ngừng hoạt động',
  });

class SpecializationService {
  listForCoach = async (coachId: string) => {
    const rows = await specializationRepository.findAll(coachId);
    return rows.map(toSpecializationResponse);
  };

  listForManager = async (query: ListSpecializationsQuery) => {
    const [rows, total] = await specializationRepository.findPage(query);
    return toPage(rows.map(toSpecializationResponse), total, query);
  };

  register = async (coachId: string, sportId: string, ip?: string) => {
    try {
      const specialization = await runTransaction(async (tx) => {
        const sport = await specializationRepository.lockSport(sportId, tx);
        if (!sport || sport.deletedAt) throw invalidSport('Bộ môn không tồn tại');
        if (!sport.isActive) throw invalidSport('Bộ môn đã ngừng hoạt động');

        const existing = await specializationRepository.findExisting(coachId, sportId, tx);
        if (existing) throw alreadyRegistered();

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
    } catch (err) {
      if (isUniqueViolation(err, 'uq_coach_spec_active')) throw alreadyRegistered();
      throw err;
    }
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
    const specialization = await runTransaction(async (tx) => {
      const current = await specializationRepository.findById(id, tx);
      if (!current) throw notFound();

      if (current.status !== 'PENDING') throw notPending();

      if (status === 'APPROVED') {
        const sport = await specializationRepository.lockSport(current.sportId, tx);
        if (!sport?.isActive || sport.deletedAt) throw sportUnavailable();
      }

      const updated = await specializationRepository.review(
        id,
        { status, reviewNote: body.reviewNote, reviewedById: managerId },
        tx,
      );
      if (!updated) throw notPending();
      await auditService.record(
        {
          accountId: managerId,
          action: status === 'APPROVED' ? 'APPROVE' : 'REJECT',
          entityType: 'COACH_SPECIALIZATION',
          entityId: id,
          oldValues: current,
          newValues: updated,
          ipAddress: ip,
        },
        tx,
      );

      const statusText = status === 'APPROVED' ? 'được duyệt' : 'bị từ chối';
      await notificationService.create(
        [
          {
            accountId: current.coachId,
            type: 'SYSTEM' as const,
            title: `Đăng ký chuyên môn đã ${statusText}`,
            message: `Đăng ký bộ môn "${current.sport.name}" đã ${statusText}.${body.reviewNote ? ` Ghi chú: ${body.reviewNote}` : ''}`,
          },
        ],
        tx,
      );
      return updated;
    });

    return toSpecializationResponse(specialization);
  };
}

export default new SpecializationService();
