import { CalendarClock, GraduationCap } from 'lucide-react';
import { formatDate } from '~/lib/format';
import type { ScheduleConflicts } from '~/lib/http-errors';

const MAX_ROWS = 8;

export function ScheduleConflictList({ bookings, sessions }: ScheduleConflicts) {
  const rows = [
    ...bookings.map((booking) => ({ ...booking, kind: 'booking' as const, label: 'Đặt sân' })),
    ...sessions.map((session) => ({ ...session, kind: 'session' as const, label: session.className })),
  ].sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
  const hidden = rows.length - MAX_ROWS;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] text-sc-muted">
        {bookings.length} booking · {sessions.length} buổi học
      </span>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {rows.slice(0, MAX_ROWS).map((row) => {
          const Icon = row.kind === 'booking' ? CalendarClock : GraduationCap;
          return (
            <li key={`${row.kind}-${row.id}`} className="flex items-center gap-2 text-[13px]">
              <Icon size={14} className="shrink-0 text-sc-muted" />
              <span className="font-semibold">{row.label}</span>
              <span className="text-sc-muted">
                {row.facility.name} · {formatDate(row.date)} {row.startTime}–{row.endTime}
              </span>
            </li>
          );
        })}
      </ul>
      {hidden > 0 && <span className="text-[13px] text-sc-muted">… và {hidden} lịch khác</span>}
    </div>
  );
}
