import type { Account } from '@sports-center/shared';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, DatePicker, Segmented, Select } from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { ErrorState, PageLoading } from '~/components/feedback/States';
import { facilitiesQueryOptions, sportsQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { useQuote } from '~/features/checkout/hooks/useCart';
import type { Buyer, CheckoutItemInput } from '~/features/checkout/types';
import { useSettings } from '~/features/settings';
import { formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { DATE_FORMAT, DAY_SHORT, addDays, formatDayLabel, todayVN } from '~/lib/time';
import { useFacilitySchedules } from '../hooks/useBookings';
import type { SlotSelection } from '../types';
import { isValidSelection } from '../utils/slot-selection';
import { SlotGrid } from './SlotGrid';

const BENEFIT_TEXT: Record<string, string> = {
  GYM_ACCESS: 'Gym miễn phí theo gói',
  FREE_SLOT: 'Slot miễn phí theo gói',
  DISCOUNT: 'Ưu đãi giảm giá theo gói',
};

interface SlotBookingPickerProps {
  user: Account;
  /** The person the booking is for (counter orders); members always book for themselves. */
  buyer?: Buyer;
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
  const [selection, setSelection] = useState<SlotSelection | null>(null);

  const bookable = useMemo(() => (facilities.data ?? []).filter((facility) => facility.isActive), [facilities.data]);
  const sportOptions = useMemo(
    () =>
      (sports.data ?? []).filter(
        (sport) =>
          sport.isActive && bookable.some((facility) => facility.sports.some((entry) => entry.id === sport.id)),
      ),
    [sports.data, bookable],
  );
  const sportId =
    sportChoice && sportOptions.some((sport) => sport.id === sportChoice) ? sportChoice : sportOptions[0]?.id;
  const sportFacilities = useMemo(
    () => bookable.filter((facility) => facility.sports.some((entry) => entry.id === sportId)),
    [bookable, sportId],
  );

  const facilityId = sportFacilities.some((facility) => facility.id === facilityChoice)
    ? facilityChoice
    : sportFacilities[0]?.id;
  const rows = sportFacilities.filter((facility) => facility.id === facilityId);

  const schedule = useFacilitySchedules(
    rows.map((facility) => facility.id),
    date,
  );

  const maxAdvance = settings.data?.maxAdvanceBookingDays ?? 14;
  const today = todayVN();
  const quickDays = Array.from({ length: Math.min(7, maxAdvance + 1) }, (_, offset) => addDays(today, offset));

  const selected = useMemo(() => {
    if (!isValidSelection(selection, schedule.schedules)) return null;
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
    return <Alert type="info" showIcon title="Chưa có sân hoặc phòng nào nhận đặt. Vui lòng quay lại sau." />;
  }

  const changeDay = (next: string) => {
    setDate(next);
    setSelection(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
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
          className="!min-w-48"
          value={facilityId}
          options={sportFacilities.map((facility) => ({ value: facility.id, label: facility.name }))}
          onChange={(value) => {
            setFacilityChoice(value);
            setSelection(null);
          }}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {quickDays.map((day) => {
            const current = dayjs(day, DATE_FORMAT);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={day === date}
                onClick={() => changeDay(day)}
                className={`flex h-12 w-12 cursor-pointer flex-col items-center justify-center rounded-lg border text-center leading-tight [transition:all_0.12s] ${
                  day === date
                    ? 'border-sc-ink bg-sc-ink text-white'
                    : 'border-sc-border bg-white text-sc-ink-2 hover:border-sc-primary-border hover:bg-sc-primary-soft'
                }`}
              >
                <small className="text-[10.5px] opacity-70">{DAY_SHORT[current.day()]}</small>
                <b className="text-[15px]">{current.format('DD')}</b>
              </button>
            );
          })}
          <DatePicker
            value={dayjs(date, DATE_FORMAT)}
            allowClear={false}
            format="DD/MM/YYYY"
            minDate={dayjs(today, DATE_FORMAT)}
            maxDate={dayjs(addDays(today, maxAdvance), DATE_FORMAT)}
            onChange={(value) => value && changeDay(value.format(DATE_FORMAT))}
            className="!w-36"
          />
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 rounded-xl border border-sc-border-soft bg-white p-4">
          <h3 className="mt-0 mb-3 font-display text-[17px] font-bold tracking-wide uppercase">
            {sportOptions.find((sport) => sport.id === sportId)?.name} · {formatDayLabel(date)}
          </h3>
          {schedule.error ? (
            <ErrorState message={toApiError(schedule.error).message} onRetry={schedule.refetch} />
          ) : (
            <SlotGrid
              facilities={rows}
              schedules={schedule.schedules}
              loading={schedule.isLoading}
              selection={selected ? selection : null}
              onSelect={setSelection}
            />
          )}
        </div>

        <aside className="rounded-xl border border-sc-border-soft bg-white p-4 xl:sticky xl:top-20">
          <small className="font-display text-[12px] font-bold tracking-[0.12em] text-sc-muted uppercase">
            Slot đã chọn
          </small>
          {!selected ? (
            <div className="mt-2 text-sc-muted">
              <h3 className="m-0 font-display text-[22px] font-extrabold uppercase text-sc-ink">Chưa chọn</h3>
              <p className="mt-1 mb-0 text-[13px]">Bấm ô trống trên lưới; bấm ô kề bên để kéo dài, tối đa 3 slot.</p>
            </div>
          ) : (
            <div className="mt-2 flex flex-col gap-3">
              <div>
                <h3 className="m-0 font-display text-[22px] font-extrabold uppercase">{selected.facility.name}</h3>
                <div className="text-[13px] text-sc-muted">
                  {formatDayLabel(date)} · {selected.startTime}–{selected.endTime}
                </div>
              </div>
              <div className="text-[14px]">
                <div className="flex justify-between border-b border-dashed border-sc-border py-1">
                  <span>Giá niêm yết</span>
                  <span className="tabular-nums">{pricing || !line ? '…' : formatVND(line.subtotal)}</span>
                </div>
                {line && line.membershipDiscount > 0 && (
                  <div className="flex justify-between border-b border-dashed border-sc-border py-1 text-sc-success">
                    <span>{BENEFIT_TEXT[String(line.snapshot.benefit)] ?? 'Ưu đãi gói'}</span>
                    <span className="tabular-nums">−{formatVND(line.membershipDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1.5 text-[17px] font-extrabold">
                  <span>Tạm tính</span>
                  <span className="tabular-nums">{pricing || !line ? '…' : formatVND(line.total)}</span>
                </div>
              </div>
              {quote.isError && <Alert type="error" showIcon title={toApiError(quote.error).message} />}
              {line && !line.valid && <Alert type="error" showIcon title={line.error?.message} />}
              <Button
                type="primary"
                block
                disabled={!line?.valid || quote.isFetching}
                onClick={() => {
                  onAdd(selected.input);
                  setSelection(null);
                }}
              >
                Thêm vào đơn
              </Button>
              <Button block type="text" onClick={() => setSelection(null)}>
                Bỏ chọn
              </Button>
              <p className="m-0 text-xs text-sc-muted-2">Giỏ chưa giữ chỗ: chỗ được xác nhận khi thanh toán.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
