import type { BookingStatus } from '@sports-center/shared';
import { Link } from '@tanstack/react-router';
import { Button, Card, Tag } from 'antd';
import { CalendarDays, History, LifeBuoy, Wallet } from 'lucide-react';
import { useState } from 'react';
import { MappedTag, type TagMap } from '~/components/ui/MappedTag';
import { MoneyFigure } from '~/components/ui/MoneyFigure';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { ORDER_STATUS_TAG } from '~/constants/payment';
import { BookingDetailDrawer } from '~/features/bookings';
import { useStaffBookings } from '~/features/bookings/hooks/useBookings';
import { useOrders } from '~/features/orders';
import { useSupportRequests } from '~/features/support/hooks/useSupport';
import { SUPPORT_CATEGORY_LABEL, SUPPORT_STATUS_TAG } from '~/features/support/types';
import { useMemberWallet } from '~/features/wallet';
import { formatDate, formatDateTime, formatRelative, formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';

const BOOKING_STATUS_TAG: TagMap<BookingStatus> = {
  CONFIRMED: { label: 'Đã xác nhận', color: 'success' },
  CANCELLED: { label: 'Đã hủy', color: 'error' },
};

interface MemberBlockProps {
  memberId: string;
  /** Viewed by a manager: no counter actions, orders open in the admin pages. */
  manager?: boolean;
}

export function MemberWalletBlock({ memberId, manager = false }: MemberBlockProps) {
  const wallet = useMemberWallet(memberId, { page: 1, limit: 4 });
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <SectionTitle>Ví</SectionTitle>
        {!manager && (
          <Link to="/reception/top-up" search={{ memberId }}>
            <Button size="small" type="primary">
              Nạp ví
            </Button>
          </Link>
        )}
      </div>
      {wallet.isError ? (
        <p className="m-0 text-sc-error">{toApiError(wallet.error).message}</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sc-paper text-sc-ink-2">
              <Wallet size={17} />
            </span>
            <div>
              <div className="font-display text-[26px] leading-none font-extrabold tabular-nums">
                {wallet.data ? <MoneyFigure amount={wallet.data.balance} /> : '…'}
              </div>
              <div className="text-[13.5px] text-sc-muted">Số dư hiện tại</div>
            </div>
          </div>
          <ul className="mt-3 mb-0 flex list-none flex-col gap-1.5 p-0 text-[14.5px]">
            {(wallet.data?.transactions.items ?? []).map((transaction) => (
              <li
                key={transaction.id}
                className="flex items-center justify-between gap-2 border-t border-sc-border-soft pt-1.5"
              >
                <span className="min-w-0">
                  <span className="block truncate">{transaction.description ?? transaction.transactionCode}</span>
                  <span className="text-[13.5px] text-sc-muted-2">{formatDateTime(transaction.createdAt)}</span>
                </span>
                <b
                  className={`whitespace-nowrap tabular-nums ${transaction.type === 'PAYMENT' ? 'text-sc-error' : 'text-sc-success'}`}
                >
                  {transaction.type === 'PAYMENT' ? '−' : '+'}
                  {formatVND(transaction.amount)}
                </b>
              </li>
            ))}
            {wallet.data && wallet.data.transactions.items.length === 0 && (
              <li className="text-sc-muted">Chưa có giao dịch ví.</li>
            )}
          </ul>
        </>
      )}
    </Card>
  );
}

export function MemberHistoryBlock({ memberId, manager = false }: MemberBlockProps) {
  const orders = useOrders({ page: 1, limit: 5, accountId: memberId });
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <SectionTitle>Lịch sử mua</SectionTitle>
        {!manager && (
          <Link to="/reception/order" search={{ memberId }}>
            <Button size="small">Tạo đơn</Button>
          </Link>
        )}
      </div>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sc-paper text-sc-ink-2">
          <History size={17} />
        </span>
        <ul className="m-0 flex min-w-0 flex-1 list-none flex-col gap-2 p-0 text-[15px]">
          {(orders.data?.items ?? []).map((order) => (
            <li
              key={order.id}
              className="flex items-center justify-between gap-2 border-b border-sc-border-soft pb-2 last:border-b-0 last:pb-0"
            >
              <Link
                to={manager ? '/admin/orders/$orderId' : '/reception/orders/$orderId'}
                params={{ orderId: order.id }}
                className="min-w-0 flex-1"
              >
                <span className="block truncate font-mono text-[14.5px] font-semibold" title={order.orderNumber}>
                  {order.orderNumber}
                </span>
                <span className="text-[13.5px] text-sc-muted">{formatDateTime(order.paidAt)}</span>
              </Link>
              <span className="flex shrink-0 flex-col items-end gap-0.5">
                <b className="tabular-nums">{formatVND(order.totalAmount)}</b>
                <MappedTag value={order.status} map={ORDER_STATUS_TAG} />
              </span>
            </li>
          ))}
          {orders.isPending && <li className="text-sc-muted">Đang tải…</li>}
          {orders.data && orders.data.items.length === 0 && <li className="text-sc-muted">Chưa có hóa đơn nào.</li>}
        </ul>
      </div>
    </Card>
  );
}

export function MemberBookingsBlock({ memberId, manager = false }: MemberBlockProps) {
  const bookings = useStaffBookings({ page: 1, limit: 5, accountId: memberId });
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  return (
    <>
      <Card>
        <div className="flex items-start justify-between gap-2">
          <SectionTitle>Đặt sân gần đây</SectionTitle>
          {!manager && (
            <Link to="/reception/bookings">
              <Button size="small">Lịch sân</Button>
            </Link>
          )}
        </div>
        {bookings.isError ? (
          <p className="m-0 text-sc-error">{toApiError(bookings.error).message}</p>
        ) : (
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sc-paper text-sc-ink-2">
              <CalendarDays size={17} />
            </span>
            <ul className="m-0 flex min-w-0 flex-1 list-none flex-col gap-2 p-0 text-[14.5px]">
              {(bookings.data?.items ?? []).map((booking) => (
                <li
                  key={booking.id}
                  className="flex items-center justify-between gap-2 border-b border-sc-border-soft pb-2 last:border-b-0 last:pb-0"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedBookingId(booking.id)}
                    className="flex min-w-0 cursor-pointer flex-col items-start border-0 bg-transparent p-0 text-left"
                  >
                    <span className="max-w-full truncate font-semibold text-sc-ink hover:text-sc-primary">
                      {booking.facility.name}
                    </span>
                    <span className="text-[13.5px] text-sc-muted tabular-nums">
                      {formatDate(booking.date)} · {booking.startTime}–{booking.endTime}
                    </span>
                  </button>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    {booking.paidAmount === null ? (
                      <span className="text-[13.5px] font-medium text-sc-muted">
                        {booking.benefit === 'FREE_SLOT' ? 'Miễn phí' : 'Theo gói'}
                      </span>
                    ) : (
                      <b className="tabular-nums">{formatVND(booking.paidAmount)}</b>
                    )}
                    <MappedTag value={booking.status} map={BOOKING_STATUS_TAG} />
                  </span>
                </li>
              ))}
              {bookings.isPending && <li className="text-sc-muted">Đang tải…</li>}
              {bookings.data && bookings.data.items.length === 0 && (
                <li className="text-sc-muted">Chưa có lượt đặt sân nào.</li>
              )}
            </ul>
          </div>
        )}
      </Card>
      <BookingDetailDrawer bookingId={selectedBookingId} onClose={() => setSelectedBookingId(null)} />
    </>
  );
}

export function MemberSupportBlock({ memberId, manager = false }: MemberBlockProps) {
  const support = useSupportRequests({ page: 1, limit: 5, accountId: memberId });

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <SectionTitle>Yêu cầu hỗ trợ</SectionTitle>
        <Link to={manager ? '/admin/support' : '/reception/support'}>
          <Button size="small">Mở hỗ trợ</Button>
        </Link>
      </div>
      {support.isError ? (
        <p className="m-0 text-sc-error">{toApiError(support.error).message}</p>
      ) : (
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sc-paper text-sc-ink-2">
            <LifeBuoy size={17} />
          </span>
          <ul className="m-0 flex min-w-0 flex-1 list-none flex-col gap-2 p-0 text-[14.5px]">
            {(support.data?.items ?? []).map((request) => {
              const statusTag = SUPPORT_STATUS_TAG[request.status];
              return (
                <li
                  key={request.id}
                  className="flex items-start justify-between gap-2 border-b border-sc-border-soft pb-2 last:border-b-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-sc-ink" title={request.subject}>
                      {request.subject}
                    </div>
                    <div className="text-[13px] text-sc-muted">
                      {SUPPORT_CATEGORY_LABEL[request.category]} · {formatRelative(request.updatedAt)}
                    </div>
                  </div>
                  <Tag color={statusTag.color} className="!m-0 shrink-0">
                    {statusTag.label}
                  </Tag>
                </li>
              );
            })}
            {support.isPending && <li className="text-sc-muted">Đang tải…</li>}
            {support.data && support.data.items.length === 0 && (
              <li className="text-sc-muted">Chưa có phiếu hỗ trợ nào.</li>
            )}
          </ul>
        </div>
      )}
    </Card>
  );
}
