import type { Booking } from '@sports-center/shared';
import { Link } from '@tanstack/react-router';
import { Button, Card, Spin, Tag } from 'antd';
import { Banknote, CalendarCheck, LifeBuoy, LogIn, User, Users } from 'lucide-react';
import { EmptyState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { StatCard } from '~/components/ui/StatCard';
import { useBookingsOn } from '~/features/bookings/hooks/useBookings';
import { refundedOf } from '~/features/checkout/utils';
import { useOrders } from '~/features/orders/hooks/useOrders';
import { useSessionsOn } from '~/features/schedule';
import { useSupportRequests } from '~/features/support/hooks/useSupport';
import { useCheckInsToday } from '~/features/training/hooks/useTraining';
import { formatVND } from '~/lib/format';
import { formatDayLabel, nowVN, todayVN } from '~/lib/time';

const BENEFIT_TAG: Partial<Record<Booking['benefit'], string>> = {
  DISCOUNT: 'Giảm giá gói',
  FREE_SLOT: 'Slot miễn phí',
  GYM_ACCESS: 'Gym miễn phí',
};

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

      {/* Buổi học hôm nay */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <span>Buổi học hôm nay</span>
            {sessions.data && sessions.data.length > 0 && (
              <span className="text-xs font-normal text-sc-muted">({sessions.data.length} buổi)</span>
            )}
          </div>
        }
        className="!mt-6 overflow-hidden rounded-xl border border-slate-200/80 shadow-sm"
        styles={{
          header: { minHeight: 52, borderBottom: '1px solid #f1f5f9' },
          body: { padding: 0 },
        }}
      >
        {sessions.isPending ? (
          <div className="flex justify-center py-12">
            <Spin />
          </div>
        ) : sessions.data && sessions.data.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {sessions.data.map((session) => (
              <div
                key={session.id}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-slate-50/70"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* Time block */}
                  <div className="flex flex-col items-center justify-center shrink-0 w-[114px] py-1.5 px-2 rounded-lg bg-emerald-50/80 border border-emerald-200/70 text-center">
                    <span className="font-mono text-[13.5px] font-bold text-emerald-800 tracking-tight">
                      {session.startTime}
                    </span>
                    <span className="text-[11px] font-medium text-emerald-600/90">đến {session.endTime}</span>
                  </div>

                  {/* Info */}
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sc-ink text-[14.5px] group-hover:text-emerald-700 transition-colors">
                        {session.class.name}
                      </span>
                      <Tag color="cyan" className="!m-0 text-xs font-normal">
                        {session.facility.name}
                      </Tag>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-sc-muted flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <User size={13} className="text-slate-400" />
                        <span>
                          HLV:{' '}
                          <strong className="font-medium text-sc-ink">
                            {session.class.coach?.fullName ?? 'Chưa phân công'}
                          </strong>
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users size={13} className="text-slate-400" />
                        <span>
                          Sĩ số:{' '}
                          <strong className="font-medium text-sc-ink">
                            {session.class.enrolledCount}/{session.class.maxStudents}
                          </strong>{' '}
                          học viên
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Action */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Link to="/reception/checkin">
                    <Button size="small" className="text-xs font-medium">
                      Điểm danh
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8">
            <EmptyState
              title="Hôm nay chưa có buổi học nào"
              description="Các buổi học theo lịch tuần sẽ xuất hiện tại đây khi đến ngày."
            />
          </div>
        )}
      </Card>

      {/* Booking sắp tới hôm nay */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <span>Booking sắp tới hôm nay</span>
            {upcoming.length > 0 && <span className="text-xs font-normal text-sc-muted">({upcoming.length} lượt)</span>}
          </div>
        }
        className="!mt-6 overflow-hidden rounded-xl border border-slate-200/80 shadow-sm"
        styles={{
          header: { minHeight: 52, borderBottom: '1px solid #f1f5f9' },
          body: { padding: 0 },
        }}
        extra={
          <Link to="/reception/bookings" className="text-[13px] font-medium text-emerald-700 hover:text-emerald-800">
            Lưới sân →
          </Link>
        }
      >
        {bookings.isPending ? (
          <div className="flex justify-center py-12">
            <Spin />
          </div>
        ) : upcoming.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {upcoming.map((booking) => (
              <div
                key={booking.id}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-slate-50/70"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* Time block */}
                  <div className="flex flex-col items-center justify-center shrink-0 w-[114px] py-1.5 px-2 rounded-lg bg-blue-50/80 border border-blue-200/70 text-center">
                    <span className="font-mono text-[13.5px] font-bold text-blue-800 tracking-tight">
                      {booking.startTime}
                    </span>
                    <span className="text-[11px] font-medium text-blue-600/90">đến {booking.endTime}</span>
                  </div>

                  {/* Info */}
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sc-ink text-[14.5px] group-hover:text-blue-700 transition-colors">
                        {booking.facility.name}
                      </span>
                      <Tag color="blue" className="!m-0 text-xs font-normal">
                        Đặt sân
                      </Tag>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-sc-muted">
                      <User size={13} className="text-slate-400 shrink-0" />
                      <span>Khách hàng:</span>
                      {booking.account ? (
                        <span className="font-medium text-sc-ink">{booking.account.fullName}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <Tag color="orange" className="!m-0 text-[11px] px-1 py-0 leading-tight">
                            Vãng lai
                          </Tag>
                          <span className="font-medium text-sc-ink">{booking.guestName}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side: Price & Check-in */}
                <div className="flex items-center gap-4 shrink-0 self-end sm:self-center">
                  <div className="flex flex-col items-end">
                    <span className="font-semibold tabular-nums text-sc-ink text-sm">
                      {booking.paidAmount === null ? 'Theo gói' : formatVND(booking.paidAmount)}
                    </span>
                    {BENEFIT_TAG[booking.benefit] && (
                      <Tag color="success" className="!m-0 text-[11px] mt-0.5">
                        {BENEFIT_TAG[booking.benefit]}
                      </Tag>
                    )}
                  </div>
                  <Link to="/reception/checkin">
                    <Button size="small" type="primary" className="text-xs font-medium">
                      Check-in
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8">
            <EmptyState
              title="Không còn lượt đặt sân nào hôm nay"
              description="Các booking trong ngày sẽ xuất hiện tại đây khi khách đặt trước hoặc đặt tại quầy."
              action={
                <Link to="/reception/bookings">
                  <Button type="primary" size="small" className="mt-2">
                    + Đặt sân tại quầy
                  </Button>
                </Link>
              }
            />
          </div>
        )}
      </Card>
    </>
  );
}
