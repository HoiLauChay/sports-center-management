import {
  ERROR_CODE,
  type CancelClassBody,
  type CreateClassBody,
  type ListClassesQuery,
  type ReviewClassBody,
  type UpdateClassBody,
} from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Prisma } from '~/generated/prisma/client';
import { toClassDetailResponse, toClassSummaryResponse } from '~/mappers/class.mapper';
import classRepository, { type ClassDetailRow, type ClassViewer } from '~/repositories/class.repository';
import courseRepository from '~/repositories/course.repository';
import facilityRepository from '~/repositories/facility.repository';
import specializationRepository from '~/repositories/specialization.repository';
import sportRepository from '~/repositories/sport.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import notificationService from '~/services/notification.service';
import scheduleService, { type TimeRange } from '~/services/schedule.service';
import { toPage } from '~/utils/pagination';
import { formatDate, fromDbTime, parseTime, toCenterDateTime, toDbTime, todayInCenter } from '~/utils/time';
import { lockRows, runTransaction, withScheduleLock } from '~/utils/transaction';

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

const notFound = () =>
  new ErrorWithStatus({ status: HTTP_STATUS.NOT_FOUND, code: ERROR_CODE.NOT_FOUND, message: 'Không tìm thấy lớp học' });
const conflict = (message: string) =>
  new ErrorWithStatus({ status: HTTP_STATUS.CONFLICT, code: ERROR_CODE.CONFLICT, message });

const assertReadyToOpen = async (current: ClassDetailRow, tx: Prisma.TransactionClient) => {
  if (!current.coachId) throw conflict('Lớp chưa có huấn luyện viên');
  if (!(await specializationRepository.isQualified(current.coachId, current.course.sportId, tx))) {
    throw conflict('Huấn luyện viên không hoạt động hoặc chưa được duyệt bộ môn');
  }
  if (
    !current.startDate ||
    formatDate(current.startDate) <= todayInCenter() ||
    !current.sessions.some(({ status }) => status === 'SCHEDULED')
  ) {
    throw conflict('Lớp phải có lịch học hợp lệ và chưa đến ngày bắt đầu');
  }
  if (!(await sportRepository.findActiveIds([current.course.sportId], tx)).length) {
    throw conflict('Bộ môn của khóa học đã ngừng hoạt động');
  }
};

class ClassService {
  cancel = async (managerId: string, id: string, { reason }: CancelClassBody, ip?: string) => {
    const { row, notifications } = await runTransaction(async (tx) => {
      await withScheduleLock(tx);
      await lockRows(tx, { classes: [id] });
      const current = await classRepository.findDetail(id, tx);
      if (!current) throw notFound();
      if (current.status === 'CANCELLED') throw conflict('Lớp học đã bị hủy');

      // Snapshot recipients before changing the class; refund integration belongs to #132.
      const enrollments = await classRepository.findActiveEnrollments(id, tx);
      const now = new Date();
      const remaining = current.sessions.filter(
        (session) =>
          session.status === 'SCHEDULED' &&
          toCenterDateTime(formatDate(session.sessionDate), fromDbTime(session.endTime)) > now,
      );
      await classRepository.cancelSessions(
        remaining.map(({ id }) => id),
        reason,
        tx,
      );
      const row = await classRepository.update(id, { status: 'CANCELLED', cancelReason: reason }, tx);
      await auditService.record(
        {
          accountId: managerId,
          action: 'UPDATE',
          entityType: 'CLASS',
          entityId: id,
          oldValues: current,
          newValues: row,
          ipAddress: ip,
        },
        tx,
      );
      for (const session of remaining) {
        await auditService.record(
          {
            accountId: managerId,
            action: 'UPDATE',
            entityType: 'CLASS_SESSION',
            entityId: session.id,
            oldValues: session,
            newValues: { ...session, status: 'CANCELLED', cancelReason: reason },
            ipAddress: ip,
          },
          tx,
        );
      }
      const recipients = new Set(enrollments.map(({ accountId }) => accountId));
      if (current.coachId) recipients.add(current.coachId);
      const notifications = await notificationService.create(
        [...recipients].map((accountId) => ({
          accountId,
          type: 'CLASS',
          title: 'Lớp học đã bị hủy',
          message: `Lớp "${current.name}" đã bị hủy. Lý do: ${reason}`,
          referenceType: 'CLASS',
          referenceId: id,
          sendEmail: true,
        })),
        tx,
      );
      return { row, notifications };
    });
    notificationService.sendEmailsAfterCommit(notifications);
    return toClassDetailResponse(row);
  };

  list = async (viewer: ClassViewer, query: ListClassesQuery) => {
    const [rows, total] = await classRepository.findPage(viewer, query);
    return toPage(
      rows.map((row) => toClassSummaryResponse(row)),
      total,
      query,
    );
  };

  get = async (viewer: ClassViewer, id: string) => {
    const row = await classRepository.findVisibleDetail(id, viewer);
    if (!row) throw notFound();
    return toClassDetailResponse(row);
  };

  update = async (managerId: string, id: string, body: UpdateClassBody, ip?: string) => {
    const row = await runTransaction(async (tx) => {
      await lockRows(tx, { classes: [id] });
      const current = await classRepository.findDetail(id, tx);
      if (!current) throw notFound();
      if (current.status === 'CANCELLED' || !current.startDate || formatDate(current.startDate) <= todayInCenter()) {
        throw conflict('Chỉ được sửa lớp trước ngày bắt đầu và khi lớp chưa bị hủy');
      }
      if ((body.minStudents ?? current.minStudents) > (body.maxStudents ?? current.maxStudents)) {
        throw invalid('maxStudents', 'Sĩ số tối đa phải không nhỏ hơn sĩ số tối thiểu');
      }
      if ((body.maxStudents ?? current.maxStudents) < current._count.enrollments) {
        throw conflict('Sĩ số tối đa không được nhỏ hơn số học viên đã đăng ký');
      }
      const updated = await classRepository.update(id, body, tx);
      await auditService.record(
        {
          accountId: managerId,
          action: 'UPDATE',
          entityType: 'CLASS',
          entityId: id,
          oldValues: current,
          newValues: updated,
          ipAddress: ip,
        },
        tx,
      );
      return updated;
    });
    return toClassDetailResponse(row);
  };

  approve = (managerId: string, id: string, body: ReviewClassBody, ip?: string) =>
    this.review(managerId, id, true, body, ip);

  reject = (managerId: string, id: string, body: ReviewClassBody, ip?: string) =>
    this.review(managerId, id, false, body, ip);

  private review = async (managerId: string, id: string, approve: boolean, { note }: ReviewClassBody, ip?: string) => {
    const { row, notifications } = await runTransaction(async (tx) => {
      await lockRows(tx, { classes: [id] });
      const current = await classRepository.findDetail(id, tx);
      if (!current) throw notFound();
      if (current.status !== 'PENDING_APPROVAL') throw conflict('Chỉ có thể duyệt hoặc từ chối lớp đang chờ duyệt');
      if (approve) await assertReadyToOpen(current, tx);

      const row = await classRepository.update(
        id,
        approve
          ? { status: 'OPEN', approvedById: managerId, approvedAt: new Date() }
          : { status: 'DRAFT', coachId: null, approvedById: null, approvedAt: null },
        tx,
      );
      await auditService.record(
        {
          accountId: managerId,
          action: approve ? 'APPROVE' : 'REJECT',
          entityType: 'CLASS',
          entityId: id,
          oldValues: current,
          newValues: row,
          ipAddress: ip,
        },
        tx,
      );
      const outcome = approve ? 'đã được mở để nhận đăng ký' : 'bị từ chối, lớp trở về trạng thái nháp';
      const notifications = current.coachId
        ? await notificationService.create(
            [
              {
                accountId: current.coachId,
                type: 'CLASS',
                title: approve ? 'Lớp học đã được duyệt' : 'Lớp học bị từ chối',
                message: `Lớp "${current.name}" ${outcome}.${note ? ` Ghi chú: ${note}` : ''}`,
                referenceType: 'CLASS',
                referenceId: id,
                sendEmail: true,
              },
            ],
            tx,
          )
        : [];
      return { row, notifications };
    });
    notificationService.sendEmailsAfterCommit(notifications);
    return toClassDetailResponse(row);
  };

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
