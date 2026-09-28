import { ERROR_CODE, type CreateSportBody, type UpdateSportBody } from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { toSportResponse } from '~/mappers/sport.mapper';
import sportRepository from '~/repositories/sport.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import uploadService from '~/services/upload.service';
import { isUniqueViolation } from '~/utils/dbError';
import { runTransaction, withScheduleLock } from '~/utils/transaction';

const notFound = () =>
  new ErrorWithStatus({ status: HTTP_STATUS.NOT_FOUND, code: ERROR_CODE.NOT_FOUND, message: 'Không tìm thấy bộ môn' });

const nameTaken = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.CONFLICT,
    code: ERROR_CODE.NAME_TAKEN,
    message: 'Tên bộ môn đã tồn tại',
    errors: [{ path: 'body.name', message: 'Tên bộ môn đã tồn tại' }],
  });

const hasDependencies = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.CONFLICT,
    code: ERROR_CODE.HAS_DEPENDENCIES,
    message: 'Bộ môn đang có lớp học chưa kết thúc, không thể thực hiện',
  });

class SportService {
  list = async (isManager: boolean) => {
    const rows = await sportRepository.findAll(isManager);
    return rows.map(toSportResponse);
  };

  create = async (managerId: string, body: CreateSportBody, ip?: string) => {
    uploadService.assertUploadedFile(body.iconUrl, null, 'SPORT_ICON', managerId, 'body.iconUrl');

    try {
      const sport = await runTransaction(async (tx) => {
        const created = await sportRepository.create(body, tx);
        await auditService.record(
          {
            accountId: managerId,
            action: 'CREATE',
            entityType: 'SPORT',
            entityId: created.id,
            newValues: created,
            ipAddress: ip,
          },
          tx,
        );
        return created;
      });
      return toSportResponse(sport);
    } catch (err) {
      if (isUniqueViolation(err, 'uq_sports_name')) throw nameTaken();
      throw err;
    }
  };

  update = async (managerId: string, id: string, body: UpdateSportBody, ip?: string) => {
    try {
      const sport = await runTransaction(async (tx) => {
        if (body.isActive === false) await withScheduleLock(tx);

        const current = await sportRepository.findById(id, tx);
        if (!current) throw notFound();

        uploadService.assertUploadedFile(body.iconUrl, current.iconUrl, 'SPORT_ICON', managerId, 'body.iconUrl');

        if (body.isActive === false && current.isActive) {
          if (await sportRepository.hasUnfinishedClasses(id, tx)) throw hasDependencies();
        }

        const updated = await sportRepository.update(id, body, tx);
        await auditService.record(
          {
            accountId: managerId,
            action: 'UPDATE',
            entityType: 'SPORT',
            entityId: id,
            oldValues: current,
            newValues: updated,
            ipAddress: ip,
          },
          tx,
        );
        return updated;
      });
      return toSportResponse(sport);
    } catch (err) {
      if (isUniqueViolation(err, 'uq_sports_name')) throw nameTaken();
      throw err;
    }
  };

  remove = async (managerId: string, id: string, ip?: string) => {
    await runTransaction(async (tx) => {
      await withScheduleLock(tx);

      const current = await sportRepository.findById(id, tx);
      if (!current) throw notFound();

      if (await sportRepository.hasUnfinishedClasses(id, tx)) throw hasDependencies();

      await sportRepository.update(id, { isActive: false, deletedAt: new Date() }, tx);
      await auditService.record(
        {
          accountId: managerId,
          action: 'DELETE',
          entityType: 'SPORT',
          entityId: id,
          oldValues: current,
          ipAddress: ip,
        },
        tx,
      );
    });
  };
}

export default new SportService();
