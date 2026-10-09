import { CRON } from '~/constants/cron';
import classRepository from '~/repositories/class.repository';
import enrollmentRepository from '~/repositories/enrollment.repository';
import classService from '~/services/class.service';
import notificationService, { type CreatedNotification } from '~/services/notification.service';
import { addDays, formatDate, fromDbTime, toCenterDateTime, todayInCenter } from '~/utils/time';
import { lockRows, runTransaction, withScheduleLock } from '~/utils/transaction';

const LEAD_TIME_MS = 24 * 60 * 60 * 1000;
const REASON = 'Lớp không đủ sĩ số tối thiểu trước buổi đầu tiên';

const firstStart = (sessions: { sessionDate: Date; startTime: Date }[]) =>
  sessions[0] ? toCenterDateTime(formatDate(sessions[0].sessionDate), fromDbTime(sessions[0].startTime)) : null;

class ClassJobService {
  cancelUnderfilled = async (now = new Date()) => {
    const today = todayInCenter(now);
    const until = new Date(now.getTime() + LEAD_TIME_MS);
    const due = (await classRepository.findStartingOn([today, addDays(today, 1)], CRON.BATCH_SIZE)).filter((cls) => {
      const start = firstStart(cls.sessions);
      return cls._count.enrollments < cls.minStudents && start !== null && start > now && start <= until;
    });

    let processed = 0;
    let notifications: CreatedNotification[] = [];
    for (const { id } of due) {
      try {
        const result = await runTransaction(async (tx) => {
          await withScheduleLock(tx);
          const studentIds = [
            ...new Set((await enrollmentRepository.findActiveByClass(id, tx)).map(({ accountId }) => accountId)),
          ];
          await lockRows(tx, { accounts: studentIds, memberProfiles: studentIds, classes: [id] });
          const current = await classRepository.findDetail(id, tx);
          const start = current && firstStart(current.sessions.filter(({ status }) => status === 'SCHEDULED'));
          if (
            !current ||
            current.status !== 'OPEN' ||
            studentIds.length >= current.minStudents ||
            !start ||
            start <= now
          ) {
            return null;
          }
          return classService.cancelLocked(tx, null, current, REASON);
        });
        if (result) {
          processed += 1;
          notifications = [...notifications, ...result.notifications];
        }
      } catch (err) {
        console.error(`Class min-students job failed for ${id}:`, err);
      }
    }
    notificationService.sendEmailsAfterCommit(notifications);
    return { processed, remaining: 0 };
  };
}

export default new ClassJobService();
