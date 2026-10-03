import { ERROR_CODE, type CreateCourseBody, type UpdateCourseBody } from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { toCourseResponse } from '~/mappers/course.mapper';
import courseRepository from '~/repositories/course.repository';
import sportRepository from '~/repositories/sport.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import uploadService from '~/services/upload.service';
import { runTransaction, withScheduleLock } from '~/utils/transaction';

const notFound = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.NOT_FOUND,
    code: ERROR_CODE.NOT_FOUND,
    message: 'Không tìm thấy khóa học',
  });

const invalidSport = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    code: ERROR_CODE.VALIDATION,
    message: 'Dữ liệu không hợp lệ',
    errors: [{ path: 'body.sportId', message: 'Bộ môn không tồn tại hoặc đã ngừng hoạt động' }],
  });

const sportLocked = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.CONFLICT,
    code: ERROR_CODE.HAS_DEPENDENCIES,
    message: 'Khóa học đã có lớp, không thể đổi bộ môn',
    errors: [{ path: 'body.sportId', message: 'Khóa học đã có lớp, không thể đổi bộ môn' }],
  });

class CourseService {
  list = async (isManager: boolean) => {
    const rows = await courseRepository.findAll(isManager);
    return rows.map(toCourseResponse);
  };

  create = async (managerId: string, body: CreateCourseBody, ip?: string) => {
    uploadService.assertUploadedFile(body.thumbnailUrl, null, 'COURSE_THUMBNAIL', managerId, 'body.thumbnailUrl');

    const course = await runTransaction(async (tx) => {
      await withScheduleLock(tx);

      if (!(await sportRepository.findActiveIds([body.sportId], tx)).length) {
        throw invalidSport();
      }

      const created = await courseRepository.create(body, tx);
      await auditService.record(
        {
          accountId: managerId,
          action: 'CREATE',
          entityType: 'COURSE',
          entityId: created.id,
          newValues: created,
          ipAddress: ip,
        },
        tx,
      );
      return created;
    });

    return toCourseResponse(course);
  };

  update = async (managerId: string, id: string, body: UpdateCourseBody, ip?: string) => {
    const course = await runTransaction(async (tx) => {
      await withScheduleLock(tx);

      const current = await courseRepository.findById(id, tx);
      if (!current) throw notFound();

      uploadService.assertUploadedFile(
        body.thumbnailUrl,
        current.thumbnailUrl,
        'COURSE_THUMBNAIL',
        managerId,
        'body.thumbnailUrl',
      );

      if (body.sportId && body.sportId !== current.sportId && (await courseRepository.hasClasses(id, tx))) {
        throw sportLocked();
      }

      const targetSportId = body.sportId ?? current.sportId;
      if (!(await sportRepository.findActiveIds([targetSportId], tx)).length) {
        throw invalidSport();
      }

      const updated = await courseRepository.update(id, body, tx);
      await auditService.record(
        {
          accountId: managerId,
          action: 'UPDATE',
          entityType: 'COURSE',
          entityId: id,
          oldValues: current,
          newValues: updated,
          ipAddress: ip,
        },
        tx,
      );
      return updated;
    });

    return toCourseResponse(course);
  };

  remove = async (managerId: string, id: string, ip?: string) => {
    const course = await runTransaction(async (tx) => {
      await withScheduleLock(tx);

      const current = await courseRepository.findById(id, tx);
      if (!current) throw notFound();

      await courseRepository.update(id, { deletedAt: new Date() }, tx);
      await auditService.record(
        {
          accountId: managerId,
          action: 'DELETE',
          entityType: 'COURSE',
          entityId: id,
          oldValues: current,
          ipAddress: ip,
        },
        tx,
      );
      return current;
    });
    return toCourseResponse(course);
  };
}

export default new CourseService();
