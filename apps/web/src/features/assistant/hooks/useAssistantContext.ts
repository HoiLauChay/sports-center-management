import dayjs from 'dayjs';
import { useMemo } from 'react';
import { useCurrentUser } from '~/features/auth';
import { useMyMemberships } from '~/features/memberships';
import { useMySchedule } from '~/features/schedule';
import { useSettings } from '~/features/settings';
import { useMyCheckIns, useMyTrainingClasses } from '~/features/training';
import { addDays, isPast, parseDate, todayVN } from '~/lib/time';
import type { AssistantContext, AssistantSource } from '../types';

export function useAssistantContext() {
  const user = useCurrentUser();
  const today = todayVN();
  const memberships = useMyMemberships().query;
  const classes = useMyTrainingClasses();
  const schedule = useMySchedule({ from: today, to: addDays(today, 13) });
  const checkIns = useMyCheckIns({ from: parseDate(today).startOf('month').format('YYYY-MM-DD'), to: today });
  const settings = useSettings();

  const context = useMemo<AssistantContext>(() => {
    const current = memberships.data?.current;
    const active = current && current.status === 'ACTIVE' && today < current.endDate ? current : null;
    const total = active ? Math.max(1, dayjs(active.endDate).diff(dayjs(active.startDate), 'day')) : 1;
    const daysLeft = active ? Math.max(0, dayjs(active.endDate).diff(dayjs(today), 'day')) : 0;

    const next = (schedule.data ?? [])
      .filter((entry) => entry.status !== 'CANCELLED' && !isPast(entry.date, entry.startTime))
      .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))[0];

    const failed: Record<AssistantSource, boolean> = {
      membership: memberships.isError,
      classes: classes.isError,
      schedule: schedule.isError,
      checkIns: checkIns.isError,
    };

    return {
      unavailable: (Object.keys(failed) as AssistantSource[]).filter((source) => failed[source]),
      firstName: user.fullName.trim().split(/\s+/).at(-1) ?? user.fullName,
      membership: active
        ? { name: active.package.name, endDate: active.endDate, daysLeft, progress: Math.min(1, daysLeft / total) }
        : null,
      classes: (classes.data ?? []).map((item) => item.name),
      nextSession: next
        ? {
            date: next.date,
            startTime: next.startTime,
            endTime: next.endTime,
            title: next.kind === 'CLASS_SESSION' ? next.class.name : 'Đặt sân / phòng',
            facility: next.facility.name,
          }
        : null,
      checkInsThisMonth: checkIns.data?.length ?? 0,
      openingHours: settings.data ? { openTime: settings.data.openTime, closeTime: settings.data.closeTime } : null,
    };
  }, [
    memberships.data,
    memberships.isError,
    classes.data,
    classes.isError,
    schedule.data,
    schedule.isError,
    checkIns.data,
    checkIns.isError,
    settings.data,
    today,
    user.fullName,
  ]);

  const loading: Record<AssistantSource, boolean> = {
    membership: memberships.isPending,
    classes: classes.isPending,
    schedule: schedule.isPending,
    checkIns: checkIns.isPending,
  };
  return { context, loading };
}
