import type { Account } from '@sports-center/shared';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, DatePicker, InputNumber, Select, Table, Tag, type TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { facilitiesQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { useQuote } from '~/features/checkout/hooks/useCart';
import type { CheckoutBuyer, CheckoutItemInput } from '~/features/checkout/types';
import { useSettings } from '~/features/settings';
import { formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { DATE_FORMAT, DAY_LABEL, DAY_SHORT, WEEK_ORDER, addDays, formatDayLabel, slotGrid, todayVN } from '~/lib/time';
import { usePackagePreview } from '../hooks/useBookings';
import type { PackageConflict, PackagePreviewBooking, PackagePreviewRequest } from '../types';

const CONFLICT_LABEL: Record<PackageConflict, string> = {
  BOOKED: 'Đã có người đặt',
  CLASS: 'Có lớp học',
  MAINTENANCE: 'Đang bảo trì',
  CLOSED: 'Ngoài giờ nhận đặt',
};

interface RecurringPackagePickerProps {
  user: Account;
  buyer?: CheckoutBuyer;
  onAdd: (selection: CheckoutItemInput) => void;
}

/**
 * Recurring facility package (UC_2.8): weekdays + slot + number of weeks → preview every session. One conflicting
 * session rejects the whole package (BR_2.18), and the conflicting dates are listed so the person can adjust.
 */
export function RecurringPackagePicker({ user, buyer, onAdd }: RecurringPackagePickerProps) {
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

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="flex flex-col gap-4 rounded-xl border border-sc-border-soft bg-white p-4">
        <div>
          <div className="mb-1 font-semibold">Sân / phòng</div>
          <Select
            className="w-full"
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
        <div className="grid gap-3 min-[480px]:grid-cols-3">
          <div>
            <div className="mb-1 font-semibold">Bắt đầu từ</div>
            <DatePicker
              allowClear={false}
              className="w-full"
              format="DD/MM/YYYY"
              value={dayjs(startDate, DATE_FORMAT)}
              minDate={dayjs(todayVN(), DATE_FORMAT)}
              onChange={(value) => value && setStartDate(value.format(DATE_FORMAT))}
            />
          </div>
          <div>
            <div className="mb-1 font-semibold">Khung giờ</div>
            <Select
              className="w-full"
              value={slotIndex ?? Math.min(12, Math.floor(slots.length / 2))}
              onChange={setSlotIndex}
              options={slots.map((entry, index) => ({ value: index, label: `${entry.startTime}–${entry.endTime}` }))}
            />
          </div>
          <div>
            <div className="mb-1 font-semibold">Số tuần</div>
            <InputNumber
              className="!w-full"
              min={1}
              max={12}
              precision={0}
              value={weeks}
              onChange={setWeeks}
              placeholder="1–12"
            />
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-sc-ink">Thứ trong tuần</span>
            <span className="text-[14.5px] text-sc-muted">
              {days.length === 0 ? (
                <span>Chọn ít nhất một thứ</span>
              ) : (
                <span>
                  {WEEK_ORDER.filter((d) => days.includes(d))
                    .map((d) => DAY_SHORT[d])
                    .join(', ')}{' '}
                  · <span className="font-semibold text-sc-primary">{days.length} buổi/tuần</span>
                </span>
              )}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {WEEK_ORDER.map((day) => {
              const isSelected = days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={DAY_LABEL[day]}
                  onClick={() => {
                    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
                  }}
                  className={`flex h-12 cursor-pointer items-center justify-center rounded-xl border px-1 text-center transition-all ${
                    isSelected
                      ? 'border-sc-primary bg-sc-primary text-white shadow-xs font-semibold ring-2 ring-sc-primary/15'
                      : 'border-sc-border bg-white text-sc-ink hover:border-sc-primary-border hover:bg-sc-paper'
                  }`}
                >
                  <span className="font-display text-base font-bold uppercase leading-none sm:text-lg">
                    {DAY_SHORT[day]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <Alert type="info" showIcon title="Gói chỉ đặt được khi mọi buổi đều còn trống." />
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
                <div className="text-[14.5px] text-sc-muted">
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
  );
}
