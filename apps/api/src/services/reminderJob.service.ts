import scheduleRepository from '~/repositories/schedule.repository';
import notificationService, { type NotificationInput } from '~/services/notification.service';
import { addDays, formatDate, formatTime, fromDbTime, toCenterDateTime, todayInCenter } from '~/utils/time';

const WINDOW_MS = 60 * 60 * 1000;

const startsWithin = (now: Date, until: Date) => (row: { bookingDate?: Date; sessionDate?: Date; startTime: Date }) => {
  const start = toCenterDateTime(formatDate((row.bookingDate ?? row.sessionDate)!), fromDbTime(row.startTime));
  return start > now && start <= until;
};

class ReminderJobService {
  run = async (now = new Date()) => {
    const today = todayInCenter(now);
    const dates = [today, addDays(today, 1)];
    const soon = startsWithin(now, new Date(now.getTime() + WINDOW_MS));
    const [bookings, sessions] = await Promise.all([
      scheduleRepository.findMemberBookingsOn(dates),
      scheduleRepository.findSessionsOn(dates),
    ]);

    const inputs: NotificationInput[] = [
      ...bookings.filter(soon).map((booking): NotificationInput => ({
        accountId: booking.accountId!,
        type: 'BOOKING',
        title: 'Sắp đến giờ đặt sân',
        message: `${booking.facility.name} lúc ${formatTime(fromDbTime(booking.startTime))} hôm ${formatDate(booking.bookingDate)}.`,
        referenceType: 'BOOKING',
        referenceId: booking.id,
        dedupKey: `reminder:booking:${booking.id}`,
      })),
      ...sessions.filter(soon).flatMap((session) =>
        [
          ...new Set([
            ...(session.class.coachId ? [session.class.coachId] : []),
            ...session.class.enrollments.map(({ accountId }) => accountId),
          ]),
        ].map((accountId): NotificationInput => ({
          accountId,
          type: 'CLASS',
          title: 'Sắp đến giờ học',
          message: `Lớp "${session.class.name}" lúc ${formatTime(fromDbTime(session.startTime))} tại ${session.facility.name}.`,
          referenceType: 'CLASS',
          referenceId: session.class.id,
          dedupKey: `reminder:session:${session.id}:${accountId}`,
        })),
      ),
    ];
    const created = inputs.length > 0 ? await notificationService.create(inputs) : [];
    return { processed: created.length, remaining: 0 };
  };
}

export default new ReminderJobService();
