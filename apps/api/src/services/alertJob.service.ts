import { ATTENDANCE_RULES } from '@sports-center/shared';

import accountRepository from '~/repositories/account.repository';
import alertRepository from '~/repositories/alert.repository';
import notificationService, { type NotificationInput } from '~/services/notification.service';
import {
  addDays,
  formatCenterDate,
  formatCenterDateTime,
  formatDate,
  fromDbTime,
  minutesInCenter,
  toCenterDateTime,
  todayInCenter,
} from '~/utils/time';

const STARTING_SOON_DAYS = 3;
const DIGEST_FROM_MINUTE = 7 * 60;
const MILESTONE_LABEL = { MID: 'giữa khóa', FINAL: 'cuối khóa' } as const;

/**
 * Hourly alerts about work left undone: attendance and progress reviews for coaches, classes about to start that are
 * not ready, maintenance in the next day, and one morning digest of the staff backlog. Dedup keys keep each one to a
 * single notification however often the job runs.
 */
class AlertJobService {
  run = async (now = new Date()) => {
    const today = todayInCenter(now);
    const inputs = [
      ...(await this.attendance(now, today)),
      ...(await this.reviews(now, today)),
      ...(await this.classesStartingSoon(today)),
      ...(await this.maintenances(now)),
      ...(await this.digest(now, today)),
    ];
    return inputs.length > 0 ? (await notificationService.create(inputs)).length : 0;
  };

  private attendance = async (now: Date, today: string): Promise<NotificationInput[]> => {
    const sessions = await alertRepository.findUnmarkedSessions(
      new Date(addDays(today, -ATTENDANCE_RULES.COACH_EDIT_DAYS)),
      new Date(today),
    );
    return sessions.flatMap((session) => {
      const date = formatDate(session.sessionDate);
      const coachId = session.coachId ?? session.class.coachId;
      if (!coachId || toCenterDateTime(date, fromDbTime(session.endTime)) > now) return [];
      const base = { accountId: coachId, type: 'CLASS' as const, referenceType: 'SESSION', referenceId: session.id };
      const inputs: NotificationInput[] = [
        {
          ...base,
          title: 'Buổi học chưa điểm danh',
          message: `Buổi ngày ${formatCenterDate(date)} của lớp "${session.class.name}" chưa được điểm danh.`,
          dedupKey: `attendance-due:${session.id}`,
        },
      ];
      const lastDay = addDays(date, ATTENDANCE_RULES.COACH_EDIT_DAYS);
      if (today === lastDay) {
        inputs.push({
          ...base,
          title: 'Hôm nay là hạn cuối điểm danh',
          message: `Sau hôm nay không sửa được điểm danh buổi ngày ${formatCenterDate(date)} của lớp "${session.class.name}".`,
          dedupKey: `attendance-lock:${session.id}`,
        });
      }
      return inputs;
    });
  };

  private reviews = async (now: Date, today: string): Promise<NotificationInput[]> => {
    const classes = await alertRepository.findClassesInProgress(new Date(addDays(today, -7)), new Date(today));
    return classes.flatMap((cls) => {
      const scheduled = cls.sessions.filter(({ status }) => status === 'SCHEDULED');
      const last = scheduled.at(-1);
      if (!last || !cls.coachId) return [];
      const started = scheduled.filter(
        (session) => toCenterDateTime(formatDate(session.sessionDate), fromDbTime(session.startTime)) <= now,
      ).length;
      const reached = {
        MID: started >= Math.ceil(scheduled.length / 2),
        FINAL: today >= formatDate(last.sessionDate),
      };
      return (['MID', 'FINAL'] as const).flatMap((milestone) => {
        if (!reached[milestone]) return [];
        const reviewed = new Set(
          cls.progressReviews.filter((review) => review.milestone === milestone).map(({ accountId }) => accountId),
        );
        const missing = cls.enrollments.filter(({ accountId }) => !reviewed.has(accountId)).length;
        if (missing === 0) return [];
        return [
          {
            accountId: cls.coachId!,
            type: 'TRAINING' as const,
            title: `Đến hạn đánh giá ${MILESTONE_LABEL[milestone]}`,
            message: `Lớp "${cls.name}" còn ${missing} học viên chưa có đánh giá ${MILESTONE_LABEL[milestone]}.`,
            referenceType: 'CLASS',
            referenceId: cls.id,
            dedupKey: `review-due:${cls.id}:${milestone}`,
          },
        ];
      });
    });
  };

  private classesStartingSoon = async (today: string): Promise<NotificationInput[]> => {
    const classes = await alertRepository.findClassesStartingBetween(
      new Date(today),
      new Date(addDays(today, STARTING_SOON_DAYS)),
    );
    if (classes.length === 0) return [];
    const managerIds = await accountRepository.findActiveManagerIds();
    return classes.flatMap((cls) => {
      const start = formatCenterDate(formatDate(cls.startDate!));
      const base = { type: 'CLASS' as const, referenceType: 'CLASS', referenceId: cls.id };
      if (cls.status === 'OPEN') {
        if (cls._count.enrollments >= cls.minStudents) return [];
        return [...managerIds, ...(cls.coachId ? [cls.coachId] : [])].map((accountId) => ({
          ...base,
          accountId,
          title: 'Lớp sắp khai giảng chưa đủ học viên',
          message: `Lớp "${cls.name}" khai giảng ngày ${start}, mới có ${cls._count.enrollments}/${cls.minStudents} học viên tối thiểu. Lớp tự hủy 24 giờ trước buổi đầu nếu chưa đủ.`,
          dedupKey: `class-underfilled:${cls.id}:${accountId}`,
        }));
      }
      return managerIds.map((accountId) => ({
        ...base,
        accountId,
        title: cls.coachId ? 'Lớp sắp khai giảng chưa được duyệt' : 'Lớp sắp khai giảng chưa có huấn luyện viên',
        message: `Lớp "${cls.name}" khai giảng ngày ${start}.`,
        dedupKey: `class-not-ready:${cls.id}:${accountId}`,
      }));
    });
  };

  private maintenances = async (now: Date): Promise<NotificationInput[]> => {
    const maintenances = await alertRepository.findMaintenancesStartingBetween(
      now,
      new Date(now.getTime() + 24 * 60 * 60 * 1000),
    );
    if (maintenances.length === 0) return [];
    const staffIds = await accountRepository.findActiveIdsWithRoles(['RECEPTIONIST', 'MANAGER']);
    return maintenances.flatMap((maintenance) =>
      staffIds.map((accountId) => ({
        accountId,
        type: 'BOOKING' as const,
        title: 'Sắp bảo trì sân',
        message: `${maintenance.facility.name} bảo trì từ ${formatCenterDateTime(maintenance.startAt)} đến ${formatCenterDateTime(maintenance.endAt)}. Lý do: ${maintenance.reason}`,
        referenceType: 'MAINTENANCE',
        referenceId: maintenance.id,
        dedupKey: `maintenance-soon:${maintenance.id}:${accountId}`,
      })),
    );
  };

  private digest = async (now: Date, today: string): Promise<NotificationInput[]> => {
    if (minutesInCenter(now) < DIGEST_FROM_MINUTE) return [];
    const counts = await alertRepository.countBacklog(new Date(today));
    const [managerIds, receptionistIds] = await Promise.all([
      accountRepository.findActiveIdsWithRoles(['MANAGER']),
      accountRepository.findActiveIdsWithRoles(['RECEPTIONIST']),
    ]);
    const lines = (entries: [number, string][]) =>
      entries.filter(([count]) => count > 0).map(([count, label]) => `${label}: ${count}`);
    const managerLines = lines([
      [counts.support, 'Yêu cầu hỗ trợ mới'],
      [counts.bank, 'Giao dịch ngân hàng chưa khớp'],
      [counts.specializations, 'Hồ sơ chuyên môn chờ duyệt'],
      [counts.registrations, 'Đăng ký dạy lớp chờ duyệt'],
      [counts.classesWithoutCoach, 'Lớp chưa có huấn luyện viên'],
    ]);
    const receptionistLines = lines([[counts.support, 'Yêu cầu hỗ trợ mới']]);
    const digestFor = (accountId: string, entries: string[]): NotificationInput[] =>
      entries.length === 0
        ? []
        : [
            {
              accountId,
              type: 'SYSTEM',
              title: 'Việc cần xử lý',
              message: entries.join(' · '),
              dedupKey: `digest:${today}:${accountId}`,
            },
          ];
    return [
      ...managerIds.flatMap((accountId) => digestFor(accountId, managerLines)),
      ...receptionistIds
        .filter((accountId) => !managerIds.includes(accountId))
        .flatMap((accountId) => digestFor(accountId, receptionistLines)),
    ];
  };
}

export default new AlertJobService();
