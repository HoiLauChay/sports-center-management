import type { Booking } from '@sports-center/shared';
import { Link } from '@tanstack/react-router';
import { Button, Card, Table, Tag, type TableColumnsType } from 'antd';
import { Banknote, CalendarCheck, LifeBuoy, LogIn } from 'lucide-react';
import { PageHeader } from '~/components/ui/PageHeader';
import { StatCard } from '~/components/ui/StatCard';
import { useBookingsOn } from '~/features/bookings/hooks/useBookings';
import { refundedOf } from '~/features/checkout/utils';
import { useOrders } from '~/features/orders/hooks/useOrders';
import { useSessionsOn } from '~/features/schedule';
import type { DaySession } from '~/features/schedule/types';
import { useSupportRequests } from '~/features/support/hooks/useSupport';
import { useCheckInsToday } from '~/features/training/hooks/useTraining';
import { formatVND } from '~/lib/format';
import { formatDayLabel, nowVN, todayVN } from '~/lib/time';

const BENEFIT_TAG: Partial<Record<Booking['benefit'], string>> = {
  DISCOUNT: 'Giảm giá gói',
  FREE_SLOT: 'Slot miễn phí',
  GYM_ACCESS: 'Gym miễn phí',
};

const sessionColumns: TableColumnsType<DaySession> = [
  {
    title: 'Giờ',
    key: 'time',
    width: 150,
    render: (_, session) => (
      <span className="whitespace-nowrap font-medium">
        {session.startTime} – {session.endTime}
      </span>
    ),
  },
  { title: 'Lớp', dataIndex: 'className' },
  { title: 'Facility', dataIndex: ['facility', 'name'], render: (name: string) => <Tag>{name}</Tag> },
  { title: 'HLV', dataIndex: 'coach', render: (name: string | null) => name ?? '—' },
];

const bookingColumns: TableColumnsType<Booking> = [
  {
    title: 'Giờ',
    key: 'time',
    width: 150,
    render: (_, booking) => (
      <span className="whitespace-nowrap font-medium">
        {booking.startTime}–{booking.endTime}
      </span>
    ),
  },
  { title: 'Facility', dataIndex: ['facility', 'name'] },
  {
    title: 'Khách',
    key: 'who',
    render: (_, booking) =>
      booking.account ? (
        booking.account.fullName
      ) : (
        <span>
          <Tag color="warning">Guest</Tag> {booking.guestName}
        </span>
      ),
  },
  {
    title: 'Giá',
    key: 'price',
    align: 'right',
    render: (_, booking) => (
      <span className="inline-flex items-center gap-2 whitespace-nowrap">
        <span className="tabular-nums">{booking.paidAmount === null ? 'Theo gói' : formatVND(booking.paidAmount)}</span>
        {BENEFIT_TAG[booking.benefit] && <Tag color="success">{BENEFIT_TAG[booking.benefit]}</Tag>}
      </span>
    ),
  },
];

/** Receptionist home: the day's counter figures, today's class sessions and the bookings still to come. */
export function ReceptionistDashboard() {
  const today = todayVN();
  const bookings = useBookingsOn(today);
  const checkIns = useCheckInsToday();
  const support = useSupportRequests({ page: 1, limit: 1, status: 'OPEN' });
  const sessions = useSessionsOn(today);
  const orders = useOrders({ page: 1, limit: 100, from: today, to: today });

  const now = nowVN().format('HH:mm');
  const counterOrders = (orders.data?.items ?? []).filter((order) => order.paymentMethod !== 'WALLET');
  const counterTotal = counterOrders.reduce((sum, order) => sum + order.totalAmount - refundedOf(order), 0);
  const upcoming = (bookings.data ?? []).filter((booking) => booking.endTime > now);
  const openRequests = support.data?.total ?? 0;

  return (
    <>
      <PageHeader
        title="Quầy lễ tân"
        description={formatDayLabel(today)}
        extra={
          <div className="flex flex-wrap gap-2">
            <Link to="/reception/order">
              <Button>Đơn tại quầy</Button>
            </Link>
            <Link to="/reception/checkin">
              <Button type="primary" icon={<LogIn size={16} />}>
                Check-in
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={LogIn}
          label="Check-in hôm nay"
          loading={checkIns.isPending}
          value={checkIns.data?.length ?? 0}
        />
        <StatCard
          icon={Banknote}
          label="Thu tại quầy hôm nay"
          loading={orders.isPending}
          value={formatVND(counterTotal)}
          hint={`${counterOrders.length} hóa đơn`}
        />
        <StatCard
          icon={CalendarCheck}
          label="Booking hôm nay"
          loading={bookings.isPending}
          value={bookings.data?.length ?? 0}
          hint={`${upcoming.length} lượt sắp tới`}
        />
        <StatCard
          icon={LifeBuoy}
          tone={openRequests > 0 ? 'warning' : 'default'}
          label="Yêu cầu chờ xử lý"
          loading={support.isPending}
          value={openRequests}
          hint={
            <Link to="/reception/support" className="font-semibold underline underline-offset-2">
              Xử lý yêu cầu
            </Link>
          }
        />
      </div>

      <Card title="Buổi học hôm nay" className="!mt-4" styles={{ header: { minHeight: 52 }, body: { padding: 0 } }}>
        <Table<DaySession>
          rowKey="id"
          size="middle"
          columns={sessionColumns}
          dataSource={sessions.data}
          loading={sessions.isPending}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'Hôm nay chưa có buổi học nào' }}
        />
      </Card>

      <Card
        title="Booking sắp tới hôm nay"
        className="!mt-4"
        styles={{ header: { minHeight: 52 }, body: { padding: 0 } }}
        extra={
          <Link to="/reception/bookings" className="text-[13px] font-medium">
            Lưới sân
          </Link>
        }
      >
        <Table<Booking>
          rowKey="id"
          size="middle"
          columns={bookingColumns}
          dataSource={upcoming}
          loading={bookings.isPending}
          pagination={{ pageSize: 6, hideOnSinglePage: true }}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'Không còn booking nào hôm nay' }}
        />
      </Card>
    </>
  );
}
