import type { PersonalScheduleQuery } from '@sports-center/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { scheduleService } from '../services/schedule.service';

export function useMySchedule(range: PersonalScheduleQuery) {
  return useQuery({
    queryKey: ['schedule', 'mine', range],
    queryFn: () => scheduleService.mine(range),
    placeholderData: keepPreviousData,
  });
}

export function useCoachSchedule(range: PersonalScheduleQuery) {
  return useQuery({
    queryKey: ['schedule', 'coach', range],
    queryFn: () => scheduleService.coach(range),
    placeholderData: keepPreviousData,
  });
}

export function useSessionsOn(date: string) {
  return useQuery({
    queryKey: ['schedule', 'on', date],
    queryFn: () => scheduleService.sessionsOn(date),
  });
}
