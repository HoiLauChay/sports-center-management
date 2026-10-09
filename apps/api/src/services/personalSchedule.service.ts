import type { PersonalScheduleQuery } from '@sports-center/shared';

import {
  byStartTime,
  toBookingScheduleItem,
  toCoachScheduleItem,
  toSessionScheduleItem,
} from '~/mappers/personalSchedule.mapper';
import personalScheduleRepository from '~/repositories/personalSchedule.repository';

class PersonalScheduleService {
  member = async (accountId: string, { from, to }: PersonalScheduleQuery) => {
    const [bookings, sessions] = await Promise.all([
      personalScheduleRepository.findBookings(accountId, from, to),
      personalScheduleRepository.findMemberSessions(accountId, from, to),
    ]);
    return [...bookings.map(toBookingScheduleItem), ...sessions.map(toSessionScheduleItem)].sort(byStartTime);
  };

  coach = async (coachId: string, { from, to }: PersonalScheduleQuery) =>
    (await personalScheduleRepository.findCoachSessions(coachId, from, to)).map(toCoachScheduleItem);
}

export default new PersonalScheduleService();
