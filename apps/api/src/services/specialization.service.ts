import { ERROR_CODE } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import { HTTP_STATUS } from '~/constants/httpStatus';
import { toSpecializationResponse } from '~/mappers/specialization.mapper';
import specializationRepository from '~/repositories/specialization.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import { runTransaction } from '~/utils/transaction';

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
}

export default new SpecializationService();
