import { ERROR_CODE, type CreateClassBody } from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { toClassDetailResponse } from '~/mappers/class.mapper';
import classRepository from '~/repositories/class.repository';
import courseRepository from '~/repositories/course.repository';
import facilityRepository from '~/repositories/facility.repository';
import sportRepository from '~/repositories/sport.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import scheduleService, { type TimeRange } from '~/services/schedule.service';
import { parseTime, toDbTime } from '~/utils/time';
import { runTransaction, withScheduleLock } from '~/utils/transaction';

const DAY_MS = 24 * 60 * 60 * 1000;

const invalid = (field: keyof CreateClassBody, message: string) =>
  new ErrorWithStatus({
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    code: ERROR_CODE.VALIDATION,
    message: 'Dữ liệu không hợp lệ',
    errors: [{ path: `body.${field}`, message }],
  });

const sortSchedule = (schedule: CreateClassBody['weeklySchedule']) =>
  [...schedule].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));

const generateSessions = (
  startDate: string,
  schedule: CreateClassBody['weeklySchedule'],
  total: number,
): TimeRange[] => {
  const sessions: TimeRange[] = [];
  for (let time = Date.parse(startDate); sessions.length < total; time += DAY_MS) {
    const date = new Date(time).toISOString().slice(0, 10);
    const dayOfWeek = new Date(time).getUTCDay();
    for (const slot of sortSchedule(schedule).filter((item) => item.dayOfWeek === dayOfWeek)) {
      if (sessions.length < total) {
        sessions.push({ date, start: parseTime(slot.startTime), end: parseTime(slot.endTime) });
      }
    }
  }
  return sessions;
};

class ClassService {
  create = async (managerId: string, body: CreateClassBody, ip?: string) => {
    const row = await runTransaction(async (tx) => {
      await withScheduleLock(tx);

      const course = await courseRepository.findById(body.courseId, tx);
      if (!course) throw invalid('courseId', 'Khóa học không tồn tại');
      if (!(await sportRepository.findActiveIds([course.sportId], tx)).length) {
        throw invalid('courseId', 'Bộ môn của khóa học đã ngừng hoạt động');
      }
      const facility = await facilityRepository.findById(body.facilityId, tx);
      if (!facility?.isActive) throw invalid('facilityId', 'Cơ sở không tồn tại hoặc đã ngừng hoạt động');
      if (!facility.sports.some(({ sport }) => sport.id === course.sportId)) {
        throw invalid('facilityId', 'Cơ sở không hỗ trợ bộ môn của khóa học');
      }

      const sessions = generateSessions(body.startDate, body.weeklySchedule, course.totalSessions);
      await scheduleService.assertAvailable(tx, { facility: { id: facility.id, exclusive: true }, ranges: sessions });

      const created = await classRepository.create(
        {
          courseId: course.id,
          facilityId: facility.id,
          name: body.name,
          minStudents: body.minStudents,
          maxStudents: body.maxStudents,
          weeklySchedule: sortSchedule(body.weeklySchedule),
          startDate: new Date(sessions[0]!.date),
          endDate: new Date(sessions.at(-1)!.date),
          sessions: {
            create: sessions.map(({ date, start, end }, index) => ({
              sessionNumber: index + 1,
              facilityId: facility.id,
              sessionDate: new Date(date),
              startTime: toDbTime(start),
              endTime: toDbTime(end),
            })),
          },
        },
        tx,
      );
      await auditService.record(
        {
          accountId: managerId,
          action: 'CREATE',
          entityType: 'CLASS',
          entityId: created.id,
          newValues: created,
          ipAddress: ip,
        },
        tx,
      );
      return created;
    });
    return toClassDetailResponse(row);
  };
}

export default new ClassService();
