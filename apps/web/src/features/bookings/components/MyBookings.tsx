import { Alert, Segmented, Table, Tabs, Tag, type TableColumnsType } from 'antd';
import { useState } from 'react';
import { EmptyState } from '~/components/feedback/States';
import { formatDate, formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { DAY_SHORT, WEEK_ORDER, formatDayLabel } from '~/lib/time';
import { useMyBookings, useMyPackages } from '../hooks/useBookings';
import type { Booking, FacilityPackage } from '../types';

const BENEFIT_TEXT: Record<Booking['benefit'], string | null> = {
  NONE: null,
  DISCOUNT: 'Giảm giá theo gói',
  GYM_ACCESS: 'Gym miễn phí',
  FREE_SLOT: 'Slot miễn phí',
};

function BookingsTab() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Booking['status'] | undefined>();
  const bookings = useMyBookings({ page, limit: 8, status });

  const columns: TableColumnsType<Booking> = [
    {
      title: 'Sân / phòng',
      key: 'facility',
      render: (_, booking) => (
        <div className="flex min-w-36 flex-col gap-0.5">
          <b>{booking.facility.name}</b>
          <span className="flex flex-wrap gap-1">
            {booking.packageId && <Tag className="!m-0">Gói định kỳ</Tag>}
            {BENEFIT_TEXT[booking.benefit] && (
              <Tag color="success" className="!m-0">
                {BENEFIT_TEXT[booking.benefit]}
              </Tag>
            )}
          </span>
        </div>
      ),
    },
    {
      title: 'Thời gian',
      key: 'time',
      render: (_, booking) => (
        <span className="whitespace-nowrap">
          {formatDayLabel(booking.date)} · {booking.startTime}–{booking.endTime}
        </span>
      ),
    },
    {
      title: 'Đã trả',
      dataIndex: 'paidAmount',
      align: 'right',
      render: (value: number) => <b className="whitespace-nowrap tabular-nums">{formatVND(value)}</b>,
    },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_, booking) => (
        <div className="flex flex-col items-start gap-0.5">
          <Tag color={booking.status === 'CONFIRMED' ? 'success' : 'default'} className="!m-0">
            {booking.status === 'CONFIRMED' ? 'Đã xác nhận' : 'Đã hủy'}
          </Tag>
        </div>
      ),
    },
  ];

  return (
    <>
      <Segmented
        className="mb-4"
        value={status ?? 'ALL'}
        onChange={(value) => {
          setStatus(value === 'ALL' ? undefined : (value as Booking['status']));
          setPage(1);
        }}
        options={[
          { value: 'ALL', label: 'Tất cả' },
          { value: 'CONFIRMED', label: 'Đã xác nhận' },
          { value: 'CANCELLED', label: 'Đã hủy' },
        ]}
      />
      {bookings.error && !bookings.data && <Alert type="error" showIcon title={toApiError(bookings.error).message} />}
      <Table<Booking>
        rowKey="id"
        size="middle"
        columns={columns}
        dataSource={bookings.data?.items}
        loading={bookings.isFetching}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: bookings.isFetching ? ' ' : <EmptyState title="Chưa có lượt đặt nào" /> }}
        pagination={{
          current: page,
          pageSize: 8,
          total: bookings.data?.total ?? 0,
          hideOnSinglePage: true,
          onChange: setPage,
        }}
      />
    </>
  );
}

function PackagesTab() {
  const packages = useMyPackages();

  const columns: TableColumnsType<FacilityPackage> = [
    { title: 'Sân / phòng', key: 'facility', render: (_, item) => <b>{item.facility.name}</b> },
    {
      title: 'Lịch',
      key: 'schedule',
      render: (_, item) => (
        <span className="whitespace-nowrap">
          {WEEK_ORDER.filter((day) => item.daysOfWeek.includes(day))
            .map((day) => DAY_SHORT[day])
            .join('/')}{' '}
          {item.startTime}–{item.endTime}
        </span>
      ),
    },
    {
      title: 'Thời gian',
      key: 'range',
      render: (_, item) => (
        <span className="whitespace-nowrap">
          {formatDate(item.startDate)} – {formatDate(item.endDate)}
        </span>
      ),
    },
    {
      title: 'Buổi',
      key: 'sessions',
      render: (_, item) =>
        `${item.bookings.filter((booking) => booking.status === 'CONFIRMED').length}/${item.bookings.length} còn hiệu lực`,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (value: FacilityPackage['status']) => (
        <Tag color={value === 'ACTIVE' ? 'success' : 'default'} className="!m-0">
          {value === 'ACTIVE' ? 'Đang hiệu lực' : 'Đã hủy'}
        </Tag>
      ),
    },
  ];

  return (
    <Table<FacilityPackage>
      rowKey="id"
      size="middle"
      columns={columns}
      dataSource={packages.data}
      loading={packages.isFetching}
      scroll={{ x: 'max-content' }}
      pagination={false}
      locale={{ emptyText: packages.isFetching ? ' ' : <EmptyState title="Chưa có gói định kỳ nào" /> }}
    />
  );
}

export function MyBookings() {
  return (
    <Tabs
      size="small"
      items={[
        { key: 'bookings', label: 'Lượt đặt', children: <BookingsTab /> },
        { key: 'packages', label: 'Gói định kỳ', children: <PackagesTab /> },
      ]}
    />
  );
}
