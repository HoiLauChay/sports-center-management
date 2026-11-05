import type { Account, Facility } from '@sports-center/shared';
import { Alert, Button, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { RefreshCw, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ErrorState } from '~/components/feedback/States';
import { useQuote } from '~/features/checkout/hooks/useCart';
import type { CheckoutBuyer, CheckoutItemInput } from '~/features/checkout/types';
import { useSettings } from '~/features/settings';
import { formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { DATE_FORMAT, DAY_SHORT, addDays, formatDayLabel, todayVN } from '~/lib/time';
import { useFacilitySchedules } from '../hooks/useBookings';
import { useSlotSelection } from '../hooks/useSlotSelection';
import { useSportFacilityChoice } from '../hooks/useSportFacilityChoice';
import { SlotGrid } from './SlotGrid';
import { SportFacilitySteps } from './SportFacilitySteps';

const BENEFIT_TEXT: Record<string, string> = {
  GYM_ACCESS: 'Gym miễn phí theo gói',
  FREE_SLOT: 'Slot miễn phí theo gói',
  DISCOUNT: 'Ưu đãi giảm giá theo gói',
};

interface SlotBookingPickerProps {
  user: Account;
  /** The person the booking is for (counter orders); members always book for themselves. */
  buyer?: CheckoutBuyer;
  onAdd: (selection: CheckoutItemInput) => void;
}

/** Sport → facility → day and slot grid, with a live price (membership benefits included) and "Thêm vào giỏ" (UC_2.6, UC_2.10). */
export function SlotBookingPicker({ user, buyer, onAdd }: SlotBookingPickerProps) {
  const choice = useSportFacilityChoice();
  const [date, setDate] = useState(todayVN());

  return (
    <SportFacilitySteps choice={choice} finalLabel="Chọn giờ">
      {choice.facility && (
        // Keyed by facility so switching courts drops the picked slot.
        <SlotSchedulePanel
          key={choice.facility.id}
          facility={choice.facility}
          date={date}
          onDateChange={setDate}
          user={user}
          buyer={buyer}
          onAdd={onAdd}
        />
      )}
    </SportFacilitySteps>
  );
}

interface SlotSchedulePanelProps extends SlotBookingPickerProps {
  facility: Facility;
  date: string;
  onDateChange: (date: string) => void;
}

function SlotSchedulePanel({ facility, date, onDateChange, user, buyer, onAdd }: SlotSchedulePanelProps) {
  const settings = useSettings();
  const rows = useMemo(() => [facility], [facility]);
  const schedule = useFacilitySchedules([facility.id], date);
  const { selection, onSelect: setSelection, invalidated } = useSlotSelection(schedule.schedules);

  const maxAdvance = settings.data?.maxAdvanceBookingDays ?? 14;
  const today = todayVN();
  const quickDays = Array.from({ length: Math.min(7, maxAdvance + 1) }, (_, offset) => addDays(today, offset));

  const selected = useMemo(() => {
    if (!selection) return null;
    const slots = schedule.schedules[selection.facilityId]?.slots;
    const first = slots?.[selection.startIndex];
    const last = slots?.[selection.startIndex + selection.count - 1];
    if (!first || !last) return null;
    const input: CheckoutItemInput = {
      type: 'FACILITY_BOOKING',
      facilityId: facility.id,
      date,
      startTime: first.startTime,
      endTime: last.endTime,
    };
    return { input, startTime: first.startTime, endTime: last.endTime };
  }, [selection, schedule.schedules, facility.id, date]);

  const quote = useQuote({ user, buyer, items: selected ? [selected.input] : [], enabled: Boolean(selected) });
  const line = selected ? quote.data?.items[0] : undefined;
  const pricing = Boolean(selected) && (quote.isFetching || !line);

  const changeDay = (next: string) => {
    onDateChange(next);
    setSelection(null);
  };

  const inStrip = quickDays.includes(date);
  const total = pricing || !line ? '…' : formatVND(line.total);
  const canAdd = Boolean(line?.valid) && !quote.isFetching && !schedule.error;
  const add = () => {
    if (!selected) return;
    onAdd(selected.input);
    setSelection(null);
  };

  return (
    <>
      <div
        className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]"
        role="group"
        aria-label="Chọn ngày"
      >
        {quickDays.map((day) => {
          const current = dayjs(day, DATE_FORMAT);
          return (
            <button
              key={day}
              type="button"
              aria-pressed={day === date}
              onClick={() => changeDay(day)}
              className={`flex h-14 min-w-14 shrink-0 cursor-pointer px-2 flex-col items-center justify-center rounded-xl border text-center leading-tight [transition:all_0.12s] ${
                day === date
                  ? 'border-sc-ink bg-sc-ink text-white'
                  : 'border-sc-border bg-white text-sc-ink-2 hover:border-sc-primary-border hover:bg-sc-primary-soft'
              }`}
            >
              <span className="text-[13.5px] opacity-70">{day === today ? 'Hôm nay' : DAY_SHORT[current.day()]}</span>
              <span className="text-[16px] font-bold">{current.format('DD')}</span>
            </button>
          );
        })}
        <DatePicker
          value={inStrip ? null : dayjs(date, DATE_FORMAT)}
          placeholder="Ngày khác"
          allowClear={false}
          format="DD/MM/YYYY"
          inputReadOnly
          minDate={dayjs(today, DATE_FORMAT)}
          maxDate={dayjs(addDays(today, maxAdvance), DATE_FORMAT)}
          onChange={(value) => value && changeDay(value.format(DATE_FORMAT))}
          className={`!h-14 !w-36 shrink-0 !rounded-xl ${inStrip ? '' : '!border-sc-ink'}`}
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 rounded-xl border border-sc-border-soft bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="m-0 font-display text-[17px] font-bold tracking-wide uppercase">
              {facility.name} · {formatDayLabel(date)}
            </h3>
            <span className="flex items-center gap-1 text-[14.5px] text-sc-muted" role="status">
              {schedule.updatedAt ? `Cập nhật ${dayjs(schedule.updatedAt).format('HH:mm')}` : 'Đang tải lịch'}
              <Button
                type="text"
                size="small"
                aria-label="Làm mới lịch"
                icon={<RefreshCw size={14} />}
                loading={schedule.isFetching}
                onClick={schedule.refetch}
              />
            </span>
          </div>
          {invalidated && (
            <Alert
              className="!mb-3"
              type="warning"
              showIcon
              title="Khung giờ đã chọn không còn khả dụng. Vui lòng chọn lại."
            />
          )}
          {schedule.error ? (
            <ErrorState message={toApiError(schedule.error).message} onRetry={schedule.refetch} />
          ) : (
            <SlotGrid
              layout="cards"
              facilities={rows}
              schedules={schedule.schedules}
              loading={schedule.isLoading}
              selection={selection}
              onSelect={setSelection}
            />
          )}
        </div>

        <aside className="hidden rounded-xl border border-sc-border-soft bg-sc-paper p-4 lg:sticky lg:top-4 lg:block">
          <span className="font-display text-[13.5px] font-bold tracking-[0.12em] text-sc-muted uppercase">
            Slot đã chọn
          </span>
          {!selected ? (
            <div className="mt-2 text-sc-muted">
              <h3 className="m-0 font-display text-[22px] font-extrabold text-sc-ink uppercase">Chưa chọn</h3>
              <p className="mt-1 mb-0 text-[14.5px]">Bấm một ô còn trống; bấm ô kề bên để kéo dài, tối đa 3 slot.</p>
            </div>
          ) : (
            <div className="mt-2 flex flex-col gap-3">
              <div>
                <h3 className="m-0 font-display text-[22px] font-extrabold uppercase">{facility.name}</h3>
                <div className="text-[14.5px] text-sc-muted">
                  {formatDayLabel(date)} · {selected.startTime}–{selected.endTime}
                </div>
              </div>
              <div className="text-[15px]">
                <div className="flex justify-between border-b border-sc-border-soft py-1.5">
                  <span>Giá niêm yết</span>
                  <span className="tabular-nums">{pricing || !line ? '…' : formatVND(line.subtotal)}</span>
                </div>
                {line && line.membershipDiscount > 0 && (
                  <div className="flex justify-between border-b border-sc-border-soft py-1.5 text-sc-success">
                    <span>{BENEFIT_TEXT[String(line.snapshot?.benefit)] ?? 'Ưu đãi gói'}</span>
                    <span className="tabular-nums">−{formatVND(line.membershipDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 pb-1 text-[17px] font-bold text-sc-ink">
                  <span>Tạm tính</span>
                  <span className="tabular-nums">{total}</span>
                </div>
              </div>
              {quote.isError && <Alert type="error" showIcon title={toApiError(quote.error).message} />}
              {line && !line.valid && <Alert type="error" showIcon title={line.error?.message} />}
              <Button type="primary" block disabled={!canAdd} onClick={add}>
                Thêm vào giỏ
              </Button>
              <Button block type="text" onClick={() => setSelection(null)}>
                Bỏ chọn
              </Button>
            </div>
          )}
        </aside>
      </div>

      {selected && <div className="h-16 lg:hidden" />}
      {selected && (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 md:bottom-0 border-t border-t-sc-border-soft bg-white px-4 py-3 shadow-[0_-6px_20px_rgba(20,19,15,0.08)] lg:hidden">
          <div className="mx-auto flex max-w-[1120px] items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">
                {facility.name} · {selected.startTime}–{selected.endTime}
              </span>
              <span className="text-[14.5px] text-sc-muted">
                {formatDayLabel(date)} · <span className="font-semibold text-sc-ink tabular-nums">{total}</span>
              </span>
              {line && !line.valid && <span className="text-[14.5px] text-sc-error">{line.error?.message}</span>}
            </div>
            <Button type="text" aria-label="Bỏ chọn" icon={<X size={18} />} onClick={() => setSelection(null)} />
            <Button type="primary" disabled={!canAdd} onClick={add}>
              Thêm vào giỏ
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
