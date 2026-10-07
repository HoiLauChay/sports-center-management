import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '~/features/auth';
import { scheduleService } from '../services/schedule.service';
import type { ScheduleRange } from '../types';

export function useMySchedule(range: ScheduleRange) {
  const user = useCurrentUser();
  return useQuery({
    queryKey: ['schedule', 'mine', user.id, range],
    queryFn: () => scheduleService.mine(user, range),
    placeholderData: keepPreviousData,
  });
}

export function useCoachSchedule(range: ScheduleRange) {
  const user = useCurrentUser();
  return useQuery({
    queryKey: ['schedule', 'coach', user.id, range],
    queryFn: () => scheduleService.coach(user, range),
    placeholderData: keepPreviousData,
  });
}

export function useSessionsOn(date: string) {
  return useQuery({
    queryKey: ['schedule', 'on', date],
    queryFn: () => scheduleService.sessionsOn(date),
  });
}
