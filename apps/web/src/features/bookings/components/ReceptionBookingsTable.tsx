import type { Booking, BookingStatus, Facility } from '@sports-center/shared';
import { Button, Segmented, Select, Tag, type TableColumnsType } from 'antd';
import { useState } from 'react';
import { DataTable } from '~/components/data/DataTable';
import { DateRangeFilter, type DateRange } from '~/components/form/DateRangeFilter';
import { SearchInput } from '~/components/form/SearchInput';
import { Highlight } from '~/components/ui/Highlight';
import { MappedTag, type TagMap } from '~/components/ui/MappedTag';
import { clickableRow } from '~/hooks/useRowLink';
import { formatVND } from '~/lib/format';
import { DEFAULT_PAGE_SIZE } from '~/lib/search';
import { formatDayLabel } from '~/lib/time';
import { useStaffBookings } from '../hooks/useBookings';
import { BookingDetailDrawer } from './BookingDetailDrawer';

const BOOKING_STATUS_TAG: TagMap<BookingStatus> = {
  CONFIRMED: { label: 'Đã xác nhận', color: 'success' },
  CANCELLED: { label: 'Đã hủy', color: 'error' },
};

const BENEFIT_SHORT: Record<Booking['benefit'], string | null> = {
  NONE: null,
  DISCOUNT: 'Giảm giá gói',
  GYM_ACCESS: 'Gym miễn phí',
  FREE_SLOT: 'Slot miễn phí',
};

function parseValidGuestPhone(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  let digits = trimmed.replace(/[\s.\-()]/g, '');
  if (digits.startsWith('+84')) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith('84') && digits.length === 11) digits = `0${digits.slice(2)}`;
  return /^0\d{9,10}$/.test(digits) ? digits : undefined;
}

interface ReceptionBookingsTableProps {
  facilities: Facility[];
}

/** Filterable paginated booking directory (`GET /bookings`) with guest phone search and detail drawer. */
export function ReceptionBookingsTable({ facilities }: ReceptionBookingsTableProps) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [facilityId, setFacilityId] = useState<string | undefined>();
  const [status, setStatus] = useState<BookingStatus | undefined>();
  const [range, setRange] = useState<DateRange>({});
  const [phoneInput, setPhoneInput] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const validGuestPhone = parseValidGuestPhone(phoneInput);
  const hasPartialPhone = phoneInput.trim() !== '' && !validGuestPhone;

  const bookings = useStaffBookings({
    page,
    limit,
    facilityId,
    status,
    from: range.from,
    to: range.to,
    guestPhone: validGuestPhone,
  });

  const columns: TableColumnsType<Booking> = [
    {
      title: 'Thời gian',
      key: 'time',
      render: (_, booking) => (
        <div className="flex flex-col gap-0.5 whitespace-nowrap">
          <span className="font-semibold text-sc-ink">{formatDayLabel(booking.date)}</span>
          <span className="text-[14px] text-sc-muted tabular-nums">
            {booking.startTime}–{booking.endTime}
          </span>
        </div>
      ),
    },
    {
      title: 'Sân / phòng',
      key: 'facility',
      render: (_, booking) => (
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-sc-ink">{booking.facility.name}</span>
          {(booking.packageId || BENEFIT_SHORT[booking.benefit]) && (
            <span className="flex flex-wrap gap-1">
              {booking.packageId && <Tag className="!m-0">Gói định kỳ</Tag>}
              {BENEFIT_SHORT[booking.benefit] && (
                <Tag color="cyan" className="!m-0">
                  {BENEFIT_SHORT[booking.benefit]}
                </Tag>
              )}
            </span>
          )}
        </div>
      ),
    },
    {
      title: 'Người đặt',
      key: 'customer',
      render: (_, booking) =>
        booking.account ? (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-sc-ink">{booking.account.fullName}</span>
            <span className="text-[13px] text-sc-muted">Hội viên</span>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <Tag color="orange" className="!m-0">
                Khách
              </Tag>
              <span className="font-medium text-sc-ink">{booking.guestName ?? 'Khách vãng lai'}</span>
            </div>
            {booking.guestPhone && (
              <span className="text-[13.5px] text-sc-muted tabular-nums">
                <Highlight keyword={validGuestPhone}>{booking.guestPhone}</Highlight>
              </span>
            )}
          </div>
        ),
    },
    {
      title: 'Đã trả',
      key: 'paid',
      align: 'right',
      render: (_, booking) => {
        if (booking.paidAmount === null) {
          return (
            <span className="whitespace-nowrap text-sc-muted">
              {booking.benefit === 'FREE_SLOT' ? 'Miễn phí' : 'Theo gói'}
            </span>
          );
        }
        return (
          <div className="flex flex-col items-end gap-0.5 whitespace-nowrap tabular-nums">
            <span className="font-semibold text-sc-ink">{formatVND(booking.paidAmount)}</span>
            {booking.paidAmount < booking.unitPrice && (
              <span className="text-[13px] text-sc-muted line-through">{formatVND(booking.unitPrice)}</span>
            )}
          </div>
        );
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (val: BookingStatus) => <MappedTag value={val} map={BOOKING_STATUS_TAG} />,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'right',
      width: 100,
      render: (_, booking) => (
        <Button
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            setSelectedId(booking.id);
          }}
        >
          Chi tiết
        </Button>
      ),
    },
  ];

  const hasFilters = Boolean(facilityId || status || range.from || range.to || validGuestPhone);

  return (
    <>
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <SearchInput
              placeholder="SĐT khách vãng lai (09...)"
              value={phoneInput}
              maxLength={15}
              onChange={(value) => {
                setPhoneInput(value);
                setPage(1);
              }}
              className="w-full sm:!w-60"
            />
            <Select
              allowClear
              showSearch={{ optionFilterProp: 'label' }}
              placeholder="Tất cả sân & phòng"
              value={facilityId}
              onChange={(value) => {
                setFacilityId(value);
                setPage(1);
              }}
              className="w-full sm:!w-52"
              options={facilities.map((facility) => ({ value: facility.id, label: facility.name }))}
            />
            <DateRangeFilter
              value={range}
              onChange={(next) => {
                setRange(next);
                setPage(1);
              }}
            />
          </div>
          <div className="max-w-full overflow-x-auto">
            <Segmented
              value={status ?? 'ALL'}
              onChange={(value) => {
                setStatus(value === 'ALL' ? undefined : (value as BookingStatus));
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Tất cả' },
                { value: 'CONFIRMED', label: 'Đã xác nhận' },
                { value: 'CANCELLED', label: 'Đã hủy' },
              ]}
            />
          </div>
        </div>
        {hasPartialPhone && (
          <span className="text-[13px] text-amber-700">
            Nhập đủ 10–11 chữ số điện thoại (ví dụ 0903000001) để lọc lượt đặt của khách vãng lai.
          </span>
        )}
      </div>

      <DataTable<Booking>
        columns={columns}
        data={bookings.data}
        isLoading={bookings.isFetching}
        error={bookings.error}
        onRetry={() => void bookings.refetch()}
        page={page}
        limit={limit}
        onPageChange={(nextPage, nextLimit) => {
          setPage(nextLimit === limit ? nextPage : 1);
          setLimit(nextLimit);
        }}
        emptyTitle={hasFilters ? 'Không tìm thấy lượt đặt sân phù hợp' : 'Chưa có lượt đặt sân nào'}
        emptyDescription={hasFilters ? 'Thử thay đổi khoảng ngày, sân hoặc số điện thoại tra cứu.' : undefined}
        onRow={(booking) => clickableRow(() => setSelectedId(booking.id))}
      />

      <BookingDetailDrawer bookingId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}
