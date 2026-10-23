import { Link, useNavigate } from '@tanstack/react-router';
import { Button } from 'antd';
import { useMemo, useState } from 'react';
import { ErrorState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { toApiError } from '~/lib/http-errors';
import { todayVN } from '~/lib/time';
import { useCoachSchedule, useMySchedule } from '../hooks/useSchedule';
import type { CalendarView } from '../types';
import { eventsOfCoach, eventsOfMember, rangeOf } from '../utils';
import { ScheduleCalendar } from './ScheduleCalendar';

function useCalendarState() {
  const [state, setState] = useState<{ view: CalendarView; anchor: string }>(() => ({
    view: 'week',
    anchor: todayVN(),
  }));
  const range = useMemo(() => rangeOf(state.view, state.anchor), [state]);
  return { state, setState, range };
}

/** `/schedule` (member): my bookings and class sessions by week or month. */
export function SchedulePage() {
  const { state, setState, range } = useCalendarState();
  const schedule = useMySchedule(range);
  const events = useMemo(() => eventsOfMember(schedule.data ?? []), [schedule.data]);

  return (
    <>
      <PageHeader title="Lịch của tôi" />
      {schedule.isError && !schedule.data ? (
        <ErrorState message={toApiError(schedule.error).message} onRetry={() => void schedule.refetch()} />
      ) : (
        <ScheduleCalendar
          events={events}
          loading={schedule.isFetching}
          view={state.view}
          anchor={state.anchor}
          onChange={setState}
          empty={
            <>
              <span className="text-sc-muted">
                {state.view === 'week' ? 'Tuần này' : 'Tháng này'} bạn chưa có lịch đặt sân hay buổi học nào.
              </span>
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/bookings">
                  <Button type="primary">Đặt sân</Button>
                </Link>
                <Link to="/classes">
                  <Button>Đăng ký lớp</Button>
                </Link>
              </div>
            </>
          }
          detailExtra={(event) =>
            event.classId ? (
              <Link to="/classes/$classId" params={{ classId: event.classId }}>
                <Button block>Xem lớp học</Button>
              </Link>
            ) : (
              <Link to="/bookings">
                <Button block>Đến trang đặt sân</Button>
              </Link>
            )
          }
        />
      )}
    </>
  );
}

/** `/coach/schedule`: the sessions a coach teaches by week or month. */
export function CoachSchedulePage() {
  const navigate = useNavigate();
  const { state, setState, range } = useCalendarState();
  const schedule = useCoachSchedule(range);
  const events = useMemo(() => eventsOfCoach(schedule.data ?? []), [schedule.data]);

  return (
    <>
      <PageHeader title="Lịch dạy" />
      {schedule.isError && !schedule.data ? (
        <ErrorState message={toApiError(schedule.error).message} onRetry={() => void schedule.refetch()} />
      ) : (
        <ScheduleCalendar
          legend={['CLASS_SESSION']}
          empty={
            <span className="text-sc-muted">
              {state.view === 'week' ? 'Tuần này' : 'Tháng này'} chưa có buổi dạy nào.
            </span>
          }
          events={events}
          loading={schedule.isFetching}
          view={state.view}
          anchor={state.anchor}
          onChange={setState}
          onOpen={(event) =>
            event.sessionId &&
            void navigate({ to: '/coach/sessions/$sessionId', params: { sessionId: event.sessionId } })
          }
        />
      )}
    </>
  );
}
