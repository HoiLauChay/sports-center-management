import { Button, Card, Modal, Segmented, Spin, Tag } from 'antd';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { InfoGrid } from '~/components/data/InfoGrid';
import { DAY_SHORT, formatDayLabel, parseDate, todayVN, WEEK_ORDER } from '~/lib/time';
import type { CalendarEvent, CalendarView, ScheduleKind } from '../types';
import { groupByDate, KIND_STYLE, monthGrid, rangeTitle, shiftAnchor, weekDays } from '../utils';

const MONTH_CHIPS = 3;

interface ScheduleCalendarProps {
  events: CalendarEvent[];
  loading?: boolean;
  view: CalendarView;
  /** The day being looked at: the week or month shown always contains it, so switching views keeps it. */
  anchor: string;
  onChange: (next: { view: CalendarView; anchor: string }) => void;
  /** Extra content under the details of an event (e.g. a link to the class). */
  detailExtra?: (event: CalendarEvent) => ReactNode;
  /** Kinds named in the colour legend; defaults to all of them. */
  legend?: ScheduleKind[];
}

function EventChip({ event, compact, onOpen }: { event: CalendarEvent; compact?: boolean; onOpen: () => void }) {
  const style = KIND_STYLE[event.kind];
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full cursor-pointer rounded-md border-0 border-l-[3px] border-solid px-2 py-1 text-left text-[12.5px] leading-snug text-sc-ink ${style.chip} ${event.cancelled ? 'opacity-55' : ''}`}
    >
      <span className={`block font-semibold ${event.cancelled ? 'line-through' : ''} ${compact ? 'truncate' : ''}`}>
        {event.startTime} {event.title}
      </span>
      {!compact && (
        <span className="block text-sc-muted">
          {event.startTime}–{event.endTime}
          {event.subtitle ? ` · ${event.subtitle}` : ''}
        </span>
      )}
    </button>
  );
}

/** Week / month calendar that colours events by kind and opens their details; the viewed day survives view changes. */
export function ScheduleCalendar({
  events,
  loading,
  view,
  anchor,
  onChange,
  detailExtra,
  legend,
}: ScheduleCalendarProps) {
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const byDate = useMemo(() => groupByDate(events), [events]);
  const today = todayVN();
  const days = view === 'week' ? weekDays(anchor) : monthGrid(anchor);
  const month = parseDate(anchor).month();

  const goTo = (date: string, nextView: CalendarView = view) => onChange({ view: nextView, anchor: date });

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            icon={<ChevronLeft size={16} />}
            aria-label="Trước"
            onClick={() => goTo(shiftAnchor(view, anchor, -1))}
          />
          <Button
            icon={<ChevronRight size={16} />}
            aria-label="Sau"
            onClick={() => goTo(shiftAnchor(view, anchor, 1))}
          />
          <Button onClick={() => goTo(today)}>Hôm nay</Button>
          <h2 className="m-0 ml-2 font-display text-[18px] font-bold tracking-wide">{rangeTitle(view, anchor)}</h2>
          {loading && <Spin size="small" />}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 text-[13px] text-sc-muted">
            {(Object.keys(KIND_STYLE) as ScheduleKind[])
              .filter((kind) => !legend || legend.includes(kind))
              .map((kind) => KIND_STYLE[kind])
              .map((style) => (
                <span key={style.label} className="flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-full ${style.dot}`} />
                  {style.label}
                </span>
              ))}
          </div>
          <Segmented
            value={view}
            onChange={(next) => goTo(anchor, next as CalendarView)}
            options={[
              { value: 'week', label: 'Tuần' },
              { value: 'month', label: 'Tháng' },
            ]}
          />
        </div>
      </div>

      {view === 'week' ? (
        <div className="grid gap-2 md:grid-cols-7">
          {days.map((date) => {
            const list = byDate.get(date) ?? [];
            const isToday = date === today;
            return (
              <div
                key={date}
                className={`flex min-h-24 flex-col gap-1.5 rounded-lg border border-solid p-2 md:min-h-56 ${isToday ? 'border-sc-primary bg-sc-primary-soft/40' : 'border-sc-border-soft'}`}
              >
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="font-semibold">{DAY_SHORT[parseDate(date).day()]}</span>
                  <span className={isToday ? 'font-bold text-sc-primary' : 'text-sc-muted'}>
                    {parseDate(date).format('DD/MM')}
                  </span>
                </div>
                {list.length === 0 ? (
                  <span className="text-[12.5px] text-sc-muted-2">—</span>
                ) : (
                  list.map((event) => <EventChip key={event.key} event={event} onOpen={() => setSelected(event)} />)
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="mb-1 hidden grid-cols-7 gap-1 text-center text-[12.5px] font-semibold text-sc-muted md:grid">
            {WEEK_ORDER.map((day) => (
              <span key={day}>{DAY_SHORT[day]}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((date) => {
              const list = byDate.get(date) ?? [];
              const inMonth = parseDate(date).month() === month;
              const isToday = date === today;
              const isAnchor = date === anchor;
              return (
                <div
                  key={date}
                  className={`flex min-h-16 flex-col gap-1 rounded-md border border-solid p-1 md:min-h-28 ${isAnchor ? 'border-sc-primary' : 'border-sc-border-soft'} ${inMonth ? '' : 'bg-sc-paper/60 text-sc-muted-2'}`}
                >
                  <button
                    type="button"
                    onClick={() => goTo(date)}
                    className={`w-fit cursor-pointer rounded border-0 bg-transparent px-1 text-[12.5px] ${isToday ? 'bg-sc-primary font-bold text-white' : 'text-inherit'}`}
                  >
                    {parseDate(date).date()}
                  </button>
                  <div className="hidden flex-col gap-1 md:flex">
                    {list.slice(0, MONTH_CHIPS).map((event) => (
                      <EventChip key={event.key} compact event={event} onOpen={() => setSelected(event)} />
                    ))}
                    {list.length > MONTH_CHIPS && (
                      <button
                        type="button"
                        onClick={() => goTo(date, 'week')}
                        className="cursor-pointer border-0 bg-transparent p-0 text-left text-[12px] text-sc-primary"
                      >
                        +{list.length - MONTH_CHIPS} lịch khác
                      </button>
                    )}
                  </div>
                  {list.length > 0 && (
                    <button
                      type="button"
                      onClick={() => goTo(date, 'week')}
                      className="cursor-pointer border-0 bg-transparent p-0 text-left text-[12px] text-sc-primary md:hidden"
                    >
                      {list.length} lịch
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

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
    </Card>
  );
}
