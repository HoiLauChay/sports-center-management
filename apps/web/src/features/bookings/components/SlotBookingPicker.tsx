import type { Account } from '@sports-center/shared';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, DatePicker, Select } from 'antd';
import dayjs from 'dayjs';
import { RefreshCw, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState, PageLoading } from '~/components/feedback/States';
import { facilitiesQueryOptions, sportsQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { useQuote } from '~/features/checkout/hooks/useCart';
import type { CheckoutBuyer, CheckoutItemInput } from '~/features/checkout/types';
import { useSettings } from '~/features/settings';
import { formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { DATE_FORMAT, DAY_SHORT, addDays, formatDayLabel, todayVN } from '~/lib/time';
import { useFacilitySchedules } from '../hooks/useBookings';
import { useSlotSelection } from '../hooks/useSlotSelection';
import { SlotGrid } from './SlotGrid';

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

/** Sport → day → slot grid, with a live price (membership benefits included) and "Thêm vào đơn" (UC_2.6, UC_2.10). */
export function SlotBookingPicker({ user, buyer, onAdd }: SlotBookingPickerProps) {
  const facilities = useQuery(facilitiesQueryOptions);
  const sports = useQuery(sportsQueryOptions);
  const settings = useSettings();
  const [sportChoice, setSportChoice] = useState<string>();
  const [facilityChoice, setFacilityChoice] = useState<string>();
  const [date, setDate] = useState(todayVN());

  const bookable = useMemo(() => (facilities.data ?? []).filter((facility) => facility.isActive), [facilities.data]);
  const sportOptions = useMemo(
    () =>
      (sports.data ?? []).filter(
        (sport) =>
          sport.isActive && bookable.some((facility) => facility.sports.some((entry) => entry.id === sport.id)),
      ),
    [sports.data, bookable],
  );
  const sportId = sportOptions.some((sport) => sport.id === sportChoice) ? sportChoice : undefined;
  const sportFacilities = useMemo(
    () => bookable.filter((facility) => facility.sports.some((entry) => entry.id === sportId)),
    [bookable, sportId],
  );

  const facilityId = sportFacilities.some((facility) => facility.id === facilityChoice) ? facilityChoice : undefined;
  const rows = sportFacilities.filter((facility) => facility.id === facilityId);

  const schedule = useFacilitySchedules(
    rows.map((facility) => facility.id),
    date,
  );

  const { selection, onSelect: setSelection, invalidated } = useSlotSelection(schedule.schedules);

  const maxAdvance = settings.data?.maxAdvanceBookingDays ?? 14;
  const today = todayVN();
  const quickDays = Array.from({ length: Math.min(7, maxAdvance + 1) }, (_, offset) => addDays(today, offset));

  const selected = useMemo(() => {
    if (!selection) return null;
    const slots = schedule.schedules[selection.facilityId]?.slots;
    const first = slots?.[selection.startIndex];
    const last = slots?.[selection.startIndex + selection.count - 1];
    const facility = rows.find((entry) => entry.id === selection.facilityId);
    if (!first || !last || !facility) return null;
    const input: CheckoutItemInput = {
      type: 'FACILITY_BOOKING',
      facilityId: facility.id,
      date,
      startTime: first.startTime,
      endTime: last.endTime,
    };
    return { facility, input, startTime: first.startTime, endTime: last.endTime };
  }, [selection, schedule.schedules, rows, date]);

  const quote = useQuote({ user, buyer, items: selected ? [selected.input] : [], enabled: Boolean(selected) });
  const line = selected ? quote.data?.items[0] : undefined;
  const pricing = Boolean(selected) && (quote.isFetching || !line);

  if (facilities.isPending || sports.isPending) return <PageLoading />;
  if (facilities.isError || sports.isError) {
    return (
      <ErrorState
        message={toApiError(facilities.error ?? sports.error).message}
        onRetry={() => {
          void facilities.refetch();
          void sports.refetch();
        }}
      />
    );
  }
  if (!sportOptions.length) {
    return <Alert type="info" showIcon title="Chưa có sân hoặc phòng nào nhận đặt." />;
  }

  const changeDay = (next: string) => {
    setDate(next);
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          aria-label="Chọn bộ môn"
          showSearch
          optionFilterProp="label"
          placeholder="Chọn bộ môn"
          className="w-full sm:!w-44"
          value={sportId}
          options={sportOptions.map((sport) => ({ value: sport.id, label: sport.name }))}
          onChange={(value) => {
            setSportChoice(value);
            setFacilityChoice(undefined);
            setSelection(null);
          }}
        />
        <Select
          aria-label="Chọn sân / phòng"
          showSearch
          optionFilterProp="label"
          placeholder="Chọn sân / phòng"
          disabled={!sportId}
          className="w-full sm:!w-auto sm:!min-w-48"
          value={facilityId}
          options={sportFacilities.map((facility) => ({ value: facility.id, label: facility.name }))}
          onChange={(value) => {
            setFacilityChoice(value);
            setSelection(null);
          }}
        />
      </div>

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
              {[sportOptions.find((sport) => sport.id === sportId)?.name, formatDayLabel(date)]
                .filter(Boolean)
                .join(' · ')}
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
          {!facilityId ? (
            <EmptyState title="Chọn bộ môn và sân / phòng để xem lịch" />
          ) : schedule.error ? (
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
                <h3 className="m-0 font-display text-[22px] font-extrabold uppercase">{selected.facility.name}</h3>
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
                {selected.facility.name} · {selected.startTime}–{selected.endTime}
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
    </div>
  );
}
