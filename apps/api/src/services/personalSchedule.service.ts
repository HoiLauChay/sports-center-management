import type { PersonalScheduleQuery } from '@sports-center/shared';

import {
  mapCoachSession,
  mapMemberSession,
  mapPersonalBooking,
  sortPersonalSchedule,
} from '~/mappers/personalSchedule.mapper';
import personalScheduleRepository from '~/repositories/personalSchedule.repository';

class PersonalScheduleService {
  member = async (accountId: string, { from, to }: PersonalScheduleQuery) => {
    const [bookings, sessions] = await personalScheduleRepository.member(accountId, from, to);
    return sortPersonalSchedule([...bookings.map(mapPersonalBooking), ...sessions.map(mapMemberSession)]);
  };

  coach = async (coachId: string, { from, to }: PersonalScheduleQuery) => {
    const sessions = await personalScheduleRepository.coach(coachId, from, to);
    return sessions.map(mapCoachSession);
  };
}

export default new PersonalScheduleService();
