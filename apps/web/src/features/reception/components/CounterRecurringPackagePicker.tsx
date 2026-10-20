import type { Account } from '@sports-center/shared';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, DatePicker, InputNumber, Select, Table, Tag, type TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { Info } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { usePackagePreview } from '~/features/bookings/hooks/useBookings';
import type { PackageConflict, PackagePreviewBooking, PackagePreviewRequest } from '~/features/bookings/types';
import { facilitiesQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { useQuote } from '~/features/checkout/hooks/useCart';
import type { CheckoutBuyer, CheckoutItemInput } from '~/features/checkout/types';
import { useSettings } from '~/features/settings';
import { formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { DATE_FORMAT, DAY_LABEL, DAY_SHORT, WEEK_ORDER, addDays, formatDayLabel, slotGrid, todayVN } from '~/lib/time';

const CONFLICT_LABEL: Record<PackageConflict, string> = {
  BOOKED: 'Đã có người đặt',
  CLASS: 'Có lớp học',
  MAINTENANCE: 'Đang bảo trì',
  CLOSED: 'Ngoài giờ nhận đặt',
};

const WEEK_PRESETS = [4, 8, 12] as const;

const DAY_PRESETS = [
  { label: 'T2·T4·T6', days: [1, 3, 5] },
  { label: 'T3·T5·T7', days: [2, 4, 6] },
  { label: 'Cuối tuần', days: [6, 0] },
  { label: 'Cả tuần', days: [0, 1, 2, 3, 4, 5, 6] },
] as const;

function FieldLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mb-1.5 text-[14.5px] font-semibold text-sc-ink-2 ${className}`}>{children}</div>;
}

function ChoiceChip({
  active,
  onClick,
  children,
  tall = false,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  tall?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`${tall ? 'h-10 min-w-10' : 'h-8 min-w-9'} cursor-pointer rounded-md border px-2 text-[14px] font-semibold whitespace-nowrap transition-colors ${
        active
          ? 'border-sc-primary bg-sc-primary-soft text-sc-primary'
          : 'border-sc-border bg-white text-sc-ink-2 hover:border-sc-primary-border'
      }`}
    >
      {children}
    </button>
  );
}

interface CounterRecurringPackagePickerProps {
  user: Account;
  buyer?: CheckoutBuyer;
  onAdd: (selection: CheckoutItemInput) => void;
}

/**
 * Recurring facility package (UC_2.8): weekdays + slot + number of weeks → preview every session. One conflicting
 * session rejects the whole package (BR_2.18), and the conflicting dates are listed so the person can adjust.
 */
export function CounterRecurringPackagePicker({ user, buyer, onAdd }: CounterRecurringPackagePickerProps) {
  const facilities = useQuery(facilitiesQueryOptions);
  const settings = useSettings();
  const [facilityId, setFacilityId] = useState<string>();
  const [startDate, setStartDate] = useState(addDays(todayVN(), 1));
  const [slotIndex, setSlotIndex] = useState<number>();
  const [weeks, setWeeks] = useState<number | null>(4);
  const [days, setDays] = useState<number[]>([]);

  const slots = useMemo(
    () =>
      settings.data ? slotGrid(settings.data.openTime, settings.data.closeTime, settings.data.slotDurationMinutes) : [],
    [settings.data],
  );
  const slot = slots[slotIndex ?? Math.min(12, Math.floor(slots.length / 2))];
  const bookable = (facilities.data ?? []).filter((facility) => facility.isActive);

  const request: PackagePreviewRequest | null =
    facilityId && slot && days.length > 0 && weeks && weeks >= 1
      ? { facilityId, startDate, daysOfWeek: [...days].sort(), startTime: slot.startTime, endTime: slot.endTime, weeks }
      : null;
  const accountId = buyer && 'accountId' in buyer ? buyer.accountId : undefined;
  const preview = usePackagePreview(user.role === 'MEMBER' || accountId ? request : null, accountId);
  const selection: CheckoutItemInput | null = request ? { type: 'FACILITY_PACKAGE', ...request } : null;
  const quote = useQuote({ user, buyer, items: selection ? [selection] : [], enabled: Boolean(selection) });
  const line = selection ? quote.data?.items[0] : undefined;

  const conflicts = preview.data?.bookings.filter((entry) => !entry.available) ?? [];
  const columns: TableColumnsType<PackagePreviewBooking> = [
    { title: '#', width: 48, render: (_, __, index) => index + 1 },
    {
      title: 'Ngày',
      dataIndex: 'date',
      render: (date: string) => <span className="whitespace-nowrap">{formatDayLabel(date)}</span>,
    },
    { title: 'Giờ', render: (_, entry) => `${entry.startTime}–${entry.endTime}` },
    {
      title: 'Tình trạng',
      key: 'status',
      render: (_, entry) =>
        entry.available ? (
          <Tag color="success" className="!m-0">
            Còn trống
          </Tag>
        ) : (
          <Tag color="error" className="!m-0">
            {entry.conflict ? CONFLICT_LABEL[entry.conflict] : 'Không đặt được'}
          </Tag>
        ),
    },
  ];

  const sameDays = (preset: readonly number[]) =>
    preset.length === days.length && preset.every((day) => days.includes(day));
  const sessions = weeks ? days.length * weeks : 0;

  return (
    <div className="@container">
      <div className="grid items-start gap-4 @4xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="@container flex flex-col gap-5 rounded-xl border border-sc-border-soft bg-white p-4">
          <div>
            <FieldLabel>Sân / phòng</FieldLabel>
            <Select
              className="w-full"
              size="large"
              placeholder="Chọn sân / phòng"
              loading={facilities.isPending}
              value={facilityId}
              onChange={setFacilityId}
              options={bookable.map((facility) => ({
                value: facility.id,
                label: `${facility.name} · ${formatVND(facility.pricePerSlot)}/slot`,
              }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 @lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)]">
            <div>
              <FieldLabel>Bắt đầu từ</FieldLabel>
              <DatePicker
                allowClear={false}
                size="large"
                className="w-full"
                format="DD/MM/YYYY"
                value={dayjs(startDate, DATE_FORMAT)}
                minDate={dayjs(todayVN(), DATE_FORMAT)}
                onChange={(value) => value && setStartDate(value.format(DATE_FORMAT))}
              />
            </div>
            <div>
              <FieldLabel>Khung giờ</FieldLabel>
              <Select
                className="w-full"
                size="large"
                value={slotIndex ?? Math.min(12, Math.floor(slots.length / 2))}
                onChange={setSlotIndex}
                options={slots.map((entry, index) => ({ value: index, label: `${entry.startTime}–${entry.endTime}` }))}
              />
            </div>
            <div className="col-span-2 @lg:col-span-1">
              <FieldLabel>Số tuần</FieldLabel>
              <div className="flex items-center gap-1.5">
                <InputNumber
                  className="!w-[72px]"
                  size="large"
                  min={1}
                  max={12}
                  precision={0}
                  value={weeks}
                  onChange={setWeeks}
                  placeholder="1–12"
                />
                {WEEK_PRESETS.map((value) => (
                  <ChoiceChip key={value} tall active={weeks === value} onClick={() => setWeeks(value)}>
                    {value}
                  </ChoiceChip>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <FieldLabel className="!mb-0">Thứ trong tuần</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {DAY_PRESETS.map((preset) => (
                  <ChoiceChip
                    key={preset.label}
                    active={sameDays(preset.days)}
                    onClick={() => setDays([...preset.days].sort())}
                  >
                    {preset.label}
                  </ChoiceChip>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEK_ORDER.map((day) => {
                const isSelected = days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={DAY_LABEL[day]}
                    title={DAY_LABEL[day]}
                    onClick={() =>
                      setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()))
                    }
                    className={`h-11 cursor-pointer rounded-lg border font-display text-[17px] font-bold uppercase transition-colors ${
                      isSelected
                        ? 'border-sc-primary bg-sc-primary text-white'
                        : day === 0 || day === 6
                          ? 'border-sc-border bg-sc-paper/60 text-sc-ink hover:border-sc-primary-border'
                          : 'border-sc-border bg-white text-sc-ink hover:border-sc-primary-border hover:bg-sc-paper'
                    }`}
                  >
                    {DAY_SHORT[day]}
                  </button>
                );
              })}
            </div>
            <div className="mt-2.5 rounded-lg bg-sc-paper px-3 py-2 text-[14.5px]">
              {days.length === 0 ? (
                <span className="font-medium text-sc-error">Chọn ít nhất một thứ trong tuần</span>
              ) : (
                <span className="text-sc-ink-2">
                  {WEEK_ORDER.filter((d) => days.includes(d))
                    .map((d) => DAY_SHORT[d])
                    .join(', ')}{' '}
                  · {days.length} buổi/tuần × {weeks ?? '?'} tuần = <b className="text-sc-primary">{sessions} buổi</b>
                </span>
              )}
            </div>
          </div>

          <p className="m-0 flex items-start gap-1.5 text-[13.5px] leading-relaxed text-sc-muted">
            <Info size={14} className="mt-0.5 shrink-0" />
            Gói chỉ đặt được khi mọi buổi đều còn trống. Nếu một buổi trùng lượt đặt khác, lớp học hoặc bảo trì, hãy đổi
            giờ hoặc thứ.
          </p>
        </div>

        <div className="rounded-xl border border-sc-border-soft bg-white p-4">
          <h3 className="mt-0 mb-3 font-display text-[17px] font-bold tracking-wide uppercase">
            Xem trước {preview.data ? `${preview.data.bookings.length} buổi` : 'lịch'}
          </h3>
          {!request ? (
            <p className="m-0 text-sc-muted">Chọn sân / phòng và thứ trong tuần để xem lịch dự kiến.</p>
          ) : preview.isError ? (
            <Alert type="error" showIcon title={toApiError(preview.error).message} />
          ) : (
            <>
              {preview.data && !preview.data.isValid && (
                <Alert
                  type="error"
                  showIcon
                  className="!mb-3"
                  title={
                    preview.data.bookings.length === 0
                      ? 'Gói không sinh được buổi nào trong khoảng đã chọn.'
                      : `Không thể thêm gói: ${conflicts.length} buổi bị xung đột`
                  }
                  description={
                    conflicts.length > 0 && (
                      <ul className="m-0 pl-4">
                        {conflicts.slice(0, 6).map((entry) => (
                          <li key={entry.date}>
                            {formatDayLabel(entry.date)} {entry.startTime}–{entry.endTime}:{' '}
                            {entry.conflict ? CONFLICT_LABEL[entry.conflict].toLowerCase() : 'không đặt được'}
                          </li>
                        ))}
                        {conflicts.length > 6 && <li>và {conflicts.length - 6} buổi khác…</li>}
                      </ul>
                    )
                  }
                />
              )}
              <Table<PackagePreviewBooking>
                rowKey="date"
                columns={columns}
                dataSource={preview.data?.bookings}
                loading={preview.isFetching}
                pagination={false}
                scroll={{ y: 280 }}
                rowClassName={(entry) => (entry.available ? '' : 'bg-[#fdf1ef]')}
              />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[13.5px] text-sc-muted">
                    Tổng gói ({preview.data?.bookings.length ?? 0} buổi, giá {formatVND(preview.data?.unitPrice ?? 0)}
                    /buổi)
                  </div>
                  <b className="text-[20px] tabular-nums">{line ? formatVND(line.total) : '…'}</b>
                  {line && line.membershipDiscount > 0 && (
                    <span className="ml-2 text-sc-success">đã giảm {formatVND(line.membershipDiscount)}</span>
                  )}
                </div>
                <Button
                  type="primary"
                  size="large"
                  disabled={!preview.data?.isValid || !selection || preview.isFetching || (line ? !line.valid : true)}
                  onClick={() => selection && onAdd(selection)}
                >
                  Thêm vào giỏ
                </Button>
              </div>
              {line && !line.valid && preview.data?.isValid && (
                <Alert type="error" showIcon className="!mt-3" title={line.error?.message} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
