import type { PersonalScheduleQuery } from '@sports-center/shared';
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { addDays } from '~/lib/time';
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

const SPAN_DAYS = 90;

/** The coach's sessions over a span longer than one request allows (a whole class), fetched in chunks. */
export function useCoachScheduleSpan(from: string | null, to: string | null) {
  const ranges: PersonalScheduleQuery[] = [];
  for (let start = from; start && to && start <= to; start = addDays(start, SPAN_DAYS)) {
    const end = addDays(start, SPAN_DAYS - 1);
    ranges.push({ from: start, to: end < to ? end : to });
  }
  return useQueries({
    queries: ranges.map((range) => ({
      queryKey: ['schedule', 'coach', range],
      queryFn: () => scheduleService.coach(range),
    })),
    combine: (results) => ({
      data: results.flatMap((result) => result.data ?? []),
      isPending: results.some((result) => result.isPending),
    }),
  });
}

export function useSessionsOn(date: string) {
  return useQuery({
    queryKey: ['schedule', 'on', date],
    queryFn: () => scheduleService.sessionsOn(date),
  });
}
