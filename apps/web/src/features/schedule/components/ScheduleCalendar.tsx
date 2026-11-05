import { Modal, Spin, Tag } from 'antd';
import { ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { InfoGrid } from '~/components/data/InfoGrid';
import {
  DAY_LABEL,
  DAY_SHORT,
  formatDayLabel,
  fromMinutes,
  isPast,
  nowVN,
  parseDate,
  todayVN,
  toMinutes,
  WEEK_ORDER,
} from '~/lib/time';
import type { CalendarEvent, CalendarView, ScheduleKind } from '../types';
import {
  countdown,
  groupByDate,
  hourRange,
  KIND_STYLE,
  layoutDay,
  monthGrid,
  nextUp,
  rangeTitle,
  shiftAnchor,
  timeRows,
  weekDays,
  yOf,
} from '../utils';

const MONTH_CHIPS = 3;
const HOUR_HEIGHT = 60;
const FOLD_HEIGHT = 30;

interface ScheduleCalendarProps {
  events: CalendarEvent[];
  loading?: boolean;
  view: CalendarView;
  /** The day being looked at: the week or month shown always contains it, so switching views keeps it. */
  anchor: string;
  onChange: (next: { view: CalendarView; anchor: string }) => void;
  /** Extra content under the details of an event (e.g. a link to the class). */
  detailExtra?: (event: CalendarEvent) => ReactNode;
  /** Opens an event somewhere else instead of the details dialog (e.g. the coach's session page). */
  onOpen?: (event: CalendarEvent) => void;
  /** Kinds named in the colour legend; defaults to all of them. */
  legend?: ScheduleKind[];
  empty?: ReactNode;
}

/** Re-renders every minute so the countdown and the "now" line keep moving. */
function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((tick) => tick + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);
}

function AttendanceDot({ event }: { event: CalendarEvent }) {
  if (!event.attendance) return null;
  return (
    <span
      className={`mr-1 inline-block size-2 rounded-full align-middle ${event.attendance.complete ? 'bg-sc-success' : 'bg-sc-warning'}`}
    />
  );
}

const CANCELLED_STRIPES = {
  backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 6px, rgba(20,19,15,0.07) 6px 12px)',
};

/** A block on the week's time grid, sized and placed by its start and end. */
function TimeBlock({
  event,
  top,
  height,
  lane,
  lanes,
  onOpen,
}: {
  event: CalendarEvent;
  top: number;
  height: number;
  lane: number;
  lanes: number;
  onOpen: () => void;
}) {
  const style = KIND_STYLE[event.kind];
  const past = isPast(event.date, event.endTime);
  const roomy = height >= HOUR_HEIGHT * 1.3;
  const look = event.cancelled
    ? 'bg-sc-paper text-sc-muted ring-1 ring-sc-line ring-inset'
    : past
      ? `${style.chip} border-l-4 border-solid text-sc-ink-2 shadow-none`
      : style.block;
  const timeColor = event.cancelled ? '' : past ? style.text : style.blockTime;
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${event.startTime}–${event.endTime} · ${event.title}`}
      style={{
        top: top + 2,
        height: Math.max(height - 4, 24),
        left: `calc(${(lane / lanes) * 100}% + 4px)`,
        width: `calc(${100 / lanes}% - 8px)`,
        ...(event.cancelled ? CANCELLED_STRIPES : {}),
      }}
      className={`absolute flex cursor-pointer flex-col overflow-hidden rounded-xl border-0 px-2.5 py-2 text-left leading-tight shadow-[0_6px_16px_-10px_rgba(20,19,15,0.55)] transition-[transform,box-shadow] duration-200 ease-sc hover:z-10 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-12px_rgba(20,19,15,0.6)] ${look}`}
    >
      <span className={`font-display text-[15px] font-bold tracking-wide ${timeColor}`}>
        {event.startTime}
        <span className="opacity-70"> – {event.endTime}</span>
      </span>
      <span
        className={`mt-0.5 text-[14px] font-semibold ${event.cancelled ? 'line-through' : ''} ${roomy ? 'line-clamp-2' : 'truncate'}`}
      >
        <AttendanceDot event={event} />
        {event.title}
      </span>
      {roomy && event.subtitle && (
        <span className="mt-auto truncate pt-1 text-[12.5px] opacity-80">{event.subtitle}</span>
      )}
      {event.cancelled && <span className="text-[12px] font-semibold text-sc-error">Đã hủy</span>}
      {event.substitute && <span className="text-[12px] font-semibold text-sc-lime">Dạy thay</span>}
    </button>
  );
}

/** A one-line pill for the month grid and the phone agenda. */
function EventPill({ event, onOpen }: { event: CalendarEvent; onOpen: () => void }) {
  const style = KIND_STYLE[event.kind];
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent px-1.5 py-0.5 text-left text-[13px] text-sc-ink transition-colors hover:bg-sc-paper ${event.cancelled ? 'opacity-55' : ''}`}
    >
      <span className={`size-2 shrink-0 rounded-full ${style.dot}`} />
      <span className={`shrink-0 font-display font-bold ${style.text}`}>{event.startTime}</span>
      <span className={`truncate ${event.cancelled ? 'line-through' : ''}`}>
        <AttendanceDot event={event} />
        {event.title}
      </span>
    </button>
  );
}

/** One line under the toolbar: the next event still to come in the range shown, and how long until it starts. */
function NextUpStrip({ event, view, onOpen }: { event?: CalendarEvent; view: CalendarView; onOpen: () => void }) {
  if (!event) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-sc-paper px-4 py-2.5 text-[14px] text-sc-muted">
        <Clock size={15} />
        Không còn lịch nào sắp tới trong {view === 'week' ? 'tuần' : 'tháng'} này.
      </div>
    );
  }
  const left = countdown(event);
  const day = parseDate(event.date);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border-0 bg-sc-paper px-4 py-2.5 text-left text-[14px] text-sc-ink-2 transition-colors hover:bg-sc-paper-2"
    >
      <span
        className={`rounded-full px-2.5 py-0.5 font-display text-[13px] font-bold uppercase tracking-wider ${left ? 'bg-sc-ink text-sc-lime' : 'bg-sc-lime text-sc-ink'}`}
      >
        {left ? 'Tiếp theo' : 'Đang diễn ra'}
      </span>
      <span className="font-semibold text-sc-ink">{event.title}</span>
      <span className="flex items-center gap-1">
        <Clock size={13} /> {DAY_SHORT[day.day()]} {day.format('DD/MM')} · {event.startTime}–{event.endTime}
      </span>
      <span className="flex min-w-0 items-center gap-1">
        <MapPin size={13} /> {event.facility.name}
      </span>
      {left && (
        <span className="ml-auto font-display text-[16px] font-bold text-sc-ink">
          còn <span className="text-sc-primary">{left}</span>
        </span>
      )}
    </button>
  );
}

const NAV_BUTTON =
  'flex size-9 cursor-pointer items-center justify-center rounded-full border border-solid border-sc-border-soft bg-sc-surface text-sc-ink-2 transition-colors hover:border-sc-ink hover:text-sc-ink';

/** Week / month calendar that colours events by kind and opens their details; the viewed day survives view changes. */
export function ScheduleCalendar({
  events,
  loading,
  view,
  anchor,
  onChange,
  detailExtra,
  onOpen,
  legend,
  empty,
}: ScheduleCalendarProps) {
  useMinuteTick();
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const byDate = useMemo(() => groupByDate(events), [events]);
  const today = todayVN();
  const days = view === 'week' ? weekDays(anchor) : monthGrid(anchor);
  const month = parseDate(anchor).month();

  const inView = events.filter((event) =>
    view === 'week' ? days.includes(event.date) : parseDate(event.date).month() === month,
  );
  const upcoming = nextUp(inView);
  const hours = hourRange(inView);

  const goTo = (date: string, nextView: CalendarView = view) => onChange({ view: nextView, anchor: date });
  const open = (event: CalendarEvent) => (onOpen ? onOpen(event) : setSelected(event));
  const nothingShown = !loading && days.every((date) => !byDate.get(date)?.length);
  const kinds = (Object.keys(KIND_STYLE) as ScheduleKind[]).filter((kind) => !legend || legend.includes(kind));

  const now = nowVN();
  const nowMinutes = now.hour() * 60 + now.minute();
  const grid = timeRows(inView, hours, HOUR_HEIGHT, FOLD_HEIGHT, days.includes(today) ? nowMinutes : undefined);
  const nowTop = days.includes(today) ? yOf(grid.rows, nowMinutes) : null;

  return (
    <div className="rounded-2xl border border-solid border-sc-border-soft bg-sc-surface">
      <div className="flex flex-col gap-3 px-3 pt-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label="Trước"
              className={NAV_BUTTON}
              onClick={() => goTo(shiftAnchor(view, anchor, -1))}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              aria-label="Sau"
              className={NAV_BUTTON}
              onClick={() => goTo(shiftAnchor(view, anchor, 1))}
            >
              <ChevronRight size={18} />
            </button>
            <button
              type="button"
              onClick={() => goTo(today)}
              className="h-9 cursor-pointer rounded-full border border-solid border-sc-border-soft bg-sc-surface px-4 text-[14px] font-semibold text-sc-ink-2 transition-colors hover:border-sc-ink hover:text-sc-ink"
            >
              Hôm nay
            </button>
            <h2 className="m-0 ml-2 truncate font-display text-[26px] font-bold uppercase tracking-wide">
              {rangeTitle(view, anchor)}
            </h2>
            {loading && <Spin size="small" />}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 text-[13.5px] text-sc-muted">
              {kinds.map((kind) => (
                <span key={kind} className="flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-full ${KIND_STYLE[kind].dot}`} />
                  {KIND_STYLE[kind].label}
                </span>
              ))}
            </div>
            <div className="flex rounded-full bg-sc-paper p-1" role="tablist">
              {(['week', 'month'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={view === option}
                  onClick={() => goTo(anchor, option)}
                  className={`h-8 cursor-pointer rounded-full border-0 px-4 font-display text-[15px] font-bold uppercase tracking-wider transition-colors ${view === option ? 'bg-sc-ink text-sc-lime' : 'bg-transparent text-sc-muted hover:text-sc-ink'}`}
                >
                  {option === 'week' ? 'Tuần' : 'Tháng'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <NextUpStrip event={upcoming} view={view} onOpen={() => upcoming && open(upcoming)} />
      </div>
      <div className="p-3 sm:p-5">
        {nothingShown && empty && (
          <div className="mb-4 flex flex-col items-center gap-3 rounded-xl border border-dashed border-sc-line bg-sc-paper px-4 py-5 text-center">
            {empty}
          </div>
        )}

        {view === 'week' ? (
          <>
            {/* Phones: one row per day. */}
            <div className="flex flex-col gap-2 md:hidden">
              {days.map((date) => {
                const list = byDate.get(date) ?? [];
                const isToday = date === today;
                const day = parseDate(date);
                return (
                  <div
                    key={date}
                    className={`flex gap-3 rounded-xl border border-solid p-2 ${isToday ? 'border-sc-ink bg-sc-paper' : 'border-sc-border-soft'}`}
                  >
                    <div
                      className={`flex w-12 shrink-0 flex-col items-center justify-center rounded-lg py-1 ${isToday ? 'bg-sc-lime text-sc-ink' : 'bg-sc-paper text-sc-ink-2'}`}
                    >
                      <span className="text-[11px] font-bold uppercase">{DAY_SHORT[day.day()]}</span>
                      <span className="font-display text-[24px] font-bold leading-none">{day.format('DD')}</span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-center">
                      {list.length === 0 ? (
                        <span className="text-[13px] text-sc-muted-2">Ngày nghỉ</span>
                      ) : (
                        list.map((event) => <EventPill key={event.key} event={event} onOpen={() => open(event)} />)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Wider screens: a time grid. */}
            <div className="hidden md:block">
              <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))]">
                <span />
                {days.map((date) => {
                  const isToday = date === today;
                  const day = parseDate(date);
                  const count = byDate.get(date)?.length ?? 0;
                  return (
                    <div key={date} className="flex flex-col items-center gap-0.5 pb-3">
                      <span
                        className={`text-[12px] font-bold uppercase tracking-widest ${isToday ? 'text-sc-ink' : 'text-sc-muted'}`}
                      >
                        {DAY_LABEL[day.day()]}
                      </span>
                      <span
                        className={`flex size-11 items-center justify-center rounded-full font-display text-[26px] font-bold leading-none ${isToday ? 'bg-sc-lime text-sc-ink shadow-[0_0_0_4px_rgba(214,242,75,0.25)]' : 'text-sc-ink-2'}`}
                      >
                        {day.format('DD')}
                      </span>
                      <span className="flex h-1.5 gap-0.5">
                        {(byDate.get(date) ?? []).slice(0, 5).map((event) => (
                          <span key={event.key} className={`size-1.5 rounded-full ${KIND_STYLE[event.kind].dot}`} />
                        ))}
                        {count === 0 && <span className="size-1.5" />}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="relative grid grid-cols-[52px_repeat(7,minmax(0,1fr))]" style={{ height: grid.height }}>
                <div className="pointer-events-none absolute inset-0">
                  {grid.rows.map((row) =>
                    row.folded ? (
                      <div
                        key={row.from}
                        className="absolute inset-x-0 flex items-center border-0 border-t border-dashed border-sc-line bg-sc-paper/70"
                        style={{
                          top: row.top,
                          height: row.height,
                          backgroundImage:
                            'repeating-linear-gradient(135deg, transparent 0 7px, rgba(20,19,15,0.035) 7px 14px)',
                        }}
                      >
                        <span className="pl-3 font-display text-[12.5px] font-semibold tracking-wide text-sc-muted-2">
                          {fromMinutes(row.from)} – {fromMinutes(row.to)}
                        </span>
                      </div>
                    ) : (
                      <div
                        key={row.from}
                        className="absolute inset-x-0 border-0 border-t border-solid border-sc-border-soft"
                        style={{ top: row.top, height: row.height }}
                      >
                        <span className="absolute right-[calc(100%-52px)] top-1 pr-2 font-display text-[13px] font-semibold text-sc-muted">
                          {fromMinutes(row.from)}
                        </span>
                      </div>
                    ),
                  )}
                </div>
                <span />
                {days.map((date) => {
                  const isToday = date === today;
                  return (
                    <div
                      key={date}
                      className={`relative border-0 border-l border-solid border-sc-border-soft ${isToday ? 'bg-sc-lime/10' : ''}`}
                    >
                      {layoutDay(byDate.get(date) ?? []).map(({ event, lane, lanes }) => {
                        const top = yOf(grid.rows, toMinutes(event.startTime)) ?? 0;
                        const bottom = yOf(grid.rows, toMinutes(event.endTime)) ?? grid.height;
                        return (
                          <TimeBlock
                            key={event.key}
                            event={event}
                            top={top}
                            height={bottom - top}
                            lane={lane}
                            lanes={lanes}
                            onOpen={() => open(event)}
                          />
                        );
                      })}
                      {isToday && nowTop !== null && (
                        <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: nowTop }}>
                          <div className="relative -mt-px h-0.5 bg-sc-ink">
                            <span className="absolute -left-1 -top-[5px] size-3 rounded-full border-2 border-solid border-sc-ink bg-sc-lime" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[12px] font-bold uppercase tracking-widest text-sc-muted">
              {WEEK_ORDER.map((day) => (
                <span key={day}>{DAY_SHORT[day]}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {days.map((date) => {
                const list = byDate.get(date) ?? [];
                const inMonth = parseDate(date).month() === month;
                const isToday = date === today;
                const isAnchor = date === anchor;
                return (
                  <div
                    key={date}
                    className={`group flex min-h-16 flex-col gap-1 rounded-xl border border-solid p-1.5 transition-colors md:min-h-32 ${isAnchor ? 'border-sc-ink' : 'border-sc-border-soft hover:border-sc-line'} ${inMonth ? 'bg-sc-surface' : 'bg-sc-paper/60 opacity-60'}`}
                  >
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => goTo(date, 'week')}
                        title="Xem tuần này"
                        className={`flex size-8 cursor-pointer items-center justify-center rounded-full border-0 font-display text-[20px] font-bold leading-none transition-colors ${isToday ? 'bg-sc-lime text-sc-ink' : 'bg-transparent text-sc-ink-2 hover:bg-sc-paper'}`}
                      >
                        {parseDate(date).date()}
                      </button>
                      {list.length > 0 && (
                        <span className="flex gap-0.5 md:hidden">
                          {list.slice(0, 3).map((event) => (
                            <span key={event.key} className={`size-1.5 rounded-full ${KIND_STYLE[event.kind].dot}`} />
                          ))}
                        </span>
                      )}
                    </div>
                    <div className="hidden min-w-0 flex-col md:flex">
                      {list.slice(0, MONTH_CHIPS).map((event) => (
                        <EventPill key={event.key} event={event} onOpen={() => open(event)} />
                      ))}
                      {list.length > MONTH_CHIPS && (
                        <button
                          type="button"
                          onClick={() => goTo(date, 'week')}
                          className="mt-0.5 w-fit cursor-pointer rounded-full border-0 bg-sc-ink px-2 py-0.5 text-[12px] font-semibold text-sc-lime"
                        >
                          +{list.length - MONTH_CHIPS} lịch khác
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Modal
        open={Boolean(selected)}
        title={selected?.title}
        footer={null}
        centered
        onCancel={() => setSelected(null)}
        destroyOnHidden
      >
        {selected && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Tag color={selected.kind === 'BOOKING' ? 'orange' : 'green'} className="!m-0">
                {KIND_STYLE[selected.kind].label}
              </Tag>
              {selected.cancelled && (
                <Tag color="error" className="!m-0">
                  Đã hủy
                </Tag>
              )}
            </div>
            <InfoGrid
              single
              items={[
                { label: 'Ngày', value: formatDayLabel(selected.date) },
                { label: 'Giờ', value: `${selected.startTime}–${selected.endTime}` },
                { label: 'Sân / phòng', value: selected.facility.name },
                ...(selected.kind === 'CLASS_SESSION' && selected.coach !== undefined
                  ? [{ label: 'Huấn luyện viên', value: selected.coach ?? 'Đang cập nhật' }]
                  : []),
              ]}
            />
            {detailExtra?.(selected)}
          </div>
        )}
      </Modal>
    </div>
  );
}
