import type { Booking } from '@sports-center/shared';
import { Link } from '@tanstack/react-router';
import { Button, Drawer, Skeleton, Tag } from 'antd';
import { Calendar, Clock, MapPin, Phone, Receipt, User } from 'lucide-react';
import { ErrorState } from '~/components/feedback/States';
import { MappedTag, type TagMap } from '~/components/ui/MappedTag';
import { useCurrentUser } from '~/features/auth';
import { formatDateTime, formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { formatDayLabel } from '~/lib/time';
import { useBookingDetail } from '../hooks/useBookings';

const BOOKING_STATUS_TAG: TagMap<Booking['status']> = {
  CONFIRMED: { label: 'Đã xác nhận', color: 'success' },
  CANCELLED: { label: 'Đã hủy', color: 'error' },
};

const BENEFIT_LABEL: Record<Booking['benefit'], string | null> = {
  NONE: null,
  DISCOUNT: 'Giảm giá theo gói hội viên',
  GYM_ACCESS: 'Miễn phí vào phòng Gym',
  FREE_SLOT: 'Sử dụng lượt đặt sân miễn phí',
};

interface BookingDetailDrawerProps {
  bookingId: string | null;
  onClose: () => void;
}

/** Staff drawer showing full customer, schedule, benefit and payment details of a booking (`GET /bookings/:id`). */
export function BookingDetailDrawer({ bookingId, onClose }: BookingDetailDrawerProps) {
  const { role } = useCurrentUser();
  const detail = useBookingDetail(bookingId);
  const booking = detail.data;
  const isManager = role === 'MANAGER';

  const paid = booking ? (booking.paidAmount ?? booking.unitPrice) : 0;
  const saved = booking ? Math.max(0, booking.unitPrice - paid) : 0;

  return (
    <Drawer open={Boolean(bookingId)} onClose={onClose} size={520} title="Chi tiết lượt đặt sân" destroyOnHidden>
      {detail.isPending ? (
        <Skeleton active paragraph={{ rows: 7 }} />
      ) : detail.isError ? (
        <ErrorState message={toApiError(detail.error).message} onRetry={() => void detail.refetch()} />
      ) : booking ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-sc-border bg-sc-paper/60 p-4">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <MappedTag value={booking.status} map={BOOKING_STATUS_TAG} />
              {booking.packageId && <Tag className="!m-0">Gói sân định kỳ</Tag>}
              {BENEFIT_LABEL[booking.benefit] && (
                <Tag color="cyan" className="!m-0">
                  {BENEFIT_LABEL[booking.benefit]}
                </Tag>
              )}
            </div>
            <div className="flex items-center gap-2 font-display text-[22px] leading-snug font-extrabold text-sc-ink">
              <MapPin size={19} className="shrink-0 text-sc-primary" />
              <span>{booking.facility.name}</span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-sc-ink-2">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Calendar size={15} className="text-sc-muted" />
                {formatDayLabel(booking.date)}
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums">
                <Clock size={15} className="text-sc-muted" />
                {booking.startTime}–{booking.endTime}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-sc-border bg-white p-4">
            <div className="mb-2.5 text-[12.5px] font-bold tracking-[0.06em] text-sc-muted uppercase">
              Thông tin người đặt
            </div>
            {booking.account ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sc-primary-soft text-sc-primary">
                      <User size={17} />
                    </span>
                    <div>
                      <div className="text-[16px] font-bold text-sc-ink">{booking.account.fullName}</div>
                      <div className="text-[13px] text-sc-muted">Hội viên trung tâm</div>
                    </div>
                  </div>
                  <Tag color="green" className="!m-0">
                    Hội viên
                  </Tag>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-sc-border-soft pt-3">
                  {isManager ? (
                    <Link to="/admin/users/$userId" params={{ userId: booking.account.id }} onClick={onClose}>
                      <Button size="small" icon={<User size={14} />}>
                        Hồ sơ hội viên
                      </Button>
                    </Link>
                  ) : (
                    <Link to="/reception/members/$memberId" params={{ memberId: booking.account.id }} onClick={onClose}>
                      <Button size="small" icon={<User size={14} />}>
                        Hồ sơ hội viên
                      </Button>
                    </Link>
                  )}
                  <Link
                    to={isManager ? '/admin/orders' : '/reception/orders'}
                    search={{ memberId: booking.account.id, service: 'BOOKING' }}
                    onClick={onClose}
                  >
                    <Button size="small" icon={<Receipt size={14} />}>
                      Hóa đơn đặt sân
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[16px] font-bold text-sc-ink">{booking.guestName ?? 'Khách vãng lai'}</span>
                  <Tag color="orange" className="!m-0">
                    Khách vãng lai
                  </Tag>
                </div>
                {booking.guestPhone && (
                  <div className="inline-flex items-center gap-1.5 text-[14.5px] text-sc-ink-2 tabular-nums">
                    <Phone size={14} className="text-sc-muted" />
                    <span>{booking.guestPhone}</span>
                  </div>
                )}
                <div className="border-t border-sc-border-soft pt-2.5">
                  <Link
                    to={isManager ? '/admin/orders' : '/reception/orders'}
                    search={{ service: 'BOOKING' }}
                    onClick={onClose}
                  >
                    <Button size="small" icon={<Receipt size={14} />}>
                      Tra cứu hóa đơn đặt sân
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-sc-border bg-white p-4">
            <div className="mb-2.5 text-[12.5px] font-bold tracking-[0.06em] text-sc-muted uppercase">
              Chi phí & ghi nhận
            </div>
            <div className="flex flex-col gap-2 text-[14.5px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sc-muted">Đơn giá khung giờ</span>
                <span className="font-medium text-sc-ink tabular-nums">{formatVND(booking.unitPrice)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sc-muted">Quyền lợi áp dụng</span>
                <span className="font-medium text-sc-ink">{BENEFIT_LABEL[booking.benefit] ?? 'Không áp dụng'}</span>
              </div>
              {saved > 0 && (
                <div className="flex items-center justify-between gap-2 text-sc-success">
                  <span>Tiết kiệm theo gói</span>
                  <span className="font-semibold tabular-nums">−{formatVND(saved)}</span>
                </div>
              )}
              <div className="mt-1 flex items-baseline justify-between gap-2 border-t border-sc-border-soft pt-2.5">
                <span className="font-semibold text-sc-ink">Thực thu</span>
                <span className="font-display text-[22px] font-extrabold text-sc-ink tabular-nums">
                  {formatVND(paid)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[13px] text-sc-muted">
            <span>Tạo lúc {formatDateTime(booking.createdAt)}</span>
            <span className="font-mono">Mã: {booking.id.slice(0, 8).toUpperCase()}</span>
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}
