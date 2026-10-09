import dayjs from 'dayjs';
import logoMark from '~/assets/brand/logo-mark.svg';
import { PAYMENT_METHOD_LABEL } from '~/constants/payment';
import {
  ORDER_ITEM_TYPE_LABEL,
  ORDER_ITEM_TYPES,
  type Order,
  type OrderItem,
  type OrderItemType,
} from '~/features/checkout/types';
import { describeLine, refundedOf } from '~/features/checkout/utils';
import { formatDate, formatVND, VN_TIMEZONE } from '~/lib/format';

/** The issuing company printed on every invoice. */
const ISSUER = [
  'Công ty TNHH Trung tâm Thể thao Sports Center',
  '123 Đường Thể Thao, P. Hiệp Phú, TP. Thủ Đức',
  'TP. Hồ Chí Minh, 700000',
  'MST: 0312 345 678',
];

const STATUS_TEXT = {
  PAID: 'Đã thanh toán',
  PARTIALLY_REFUNDED: 'Đã hoàn một phần',
  REFUNDED: 'Đã hoàn toàn bộ',
} as const;

const asText = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value) : '');

/** `14/09 18:00` for a date with a time, `14/09/2026` for a bare date. */
function when(date: unknown, time?: unknown) {
  const day = asText(date);
  if (!day) return '—';
  const clock = asText(time);
  return clock ? `${dayjs(day).format('DD/MM')} ${clock}` : formatDate(day);
}

/** The slot count and the start / end of a line, read from its frozen snapshot. */
function timing(type: OrderItemType, snapshot: Record<string, unknown>) {
  switch (type) {
    case 'FACILITY_BOOKING':
      return {
        slots: asText(snapshot.slots) || '1',
        start: when(snapshot.date, snapshot.startTime),
        end: when(snapshot.date, snapshot.endTime),
      };
    case 'FACILITY_PACKAGE':
      return {
        slots: asText(snapshot.sessions) || '—',
        start: when(snapshot.startDate, snapshot.startTime),
        end: when(snapshot.endDate, snapshot.endTime),
      };
    case 'COURSE_ENROLLMENT':
      return {
        slots: asText(snapshot.totalSessions) || '—',
        start: when(snapshot.startDate),
        end: when(snapshot.endDate),
      };
    case 'MEMBERSHIP':
      return { slots: '1', start: when(snapshot.periodStart), end: when(snapshot.periodEnd) };
  }
}

function money(amount: number, sign: '' | '−' = '') {
  return `${sign}${formatVND(amount)}`;
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
      <p className="m-0 mb-2 text-[12.5px] font-bold text-[#3d3b35]">{title}</p>
      {children}
    </div>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return <p className="m-0 text-[12.5px] text-[#3d3b35]">{children}</p>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-[12.5px] text-[#3d3b35]">
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-0 border-b border-solid border-[#e2ddd2] py-3 text-[13px] text-[#3d3b35]">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** Notes that explain how a line's price came about, e.g. `giá gốc 240.000 ₫, ưu đãi gói −60.000 ₫`. */
function priceNote(order: Order, item: OrderItem) {
  const parts = [`giá gốc ${formatVND(item.subtotal)}`];
  if (item.membershipDiscount > 0) parts.push(`ưu đãi gói −${formatVND(item.membershipDiscount)}`);
  if (item.couponDiscount > 0) parts.push(`mã giảm −${formatVND(item.couponDiscount)}`);
  const refunded = refundedOf(order, item.id);
  if (refunded > 0) parts.push(`đã hoàn ${formatVND(refunded)}`);
  return parts.join(', ');
}

/**
 * The printable A4 invoice, built only from the order's frozen snapshot (BR_3.4) and laid out like the design. It is
 * invisible on screen and is what the browser prints (or saves as PDF) from the "In" / "Tải PDF" buttons.
 */
export function InvoiceSheet({ order }: { order: Order }) {
  const refunded = refundedOf(order);
  const buyerName = order.account?.fullName ?? order.guestName ?? '—';
  const paidAt = dayjs(order.paidAt).tz(VN_TIMEZONE);
  const groups = ORDER_ITEM_TYPES.map((type) => ({
    type,
    items: order.items.filter((item) => item.type === type),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="print-sheet hidden bg-white px-14 pt-14 pb-12 font-body text-[#14130f] print:block">
      <div className="flex items-center gap-2.5">
        <img src={logoMark} alt="" className="size-[34px]" />
        <span className="font-display text-[26px] font-extrabold tracking-[0.02em] text-[#0f4d34] uppercase">
          Sports Center
        </span>
      </div>
      <p className="m-0 mt-[22px] text-[18px]">Hóa đơn thanh toán đơn hàng ngày {formatDate(order.paidAt)}</p>

      <div className="mt-[34px] flex gap-10">
        <Block title="Đơn vị phát hành">
          {ISSUER.map((line) => (
            <Line key={line}>{line}</Line>
          ))}
        </Block>
        <Block title="Thông tin hóa đơn">
          <InfoRow label="Số hóa đơn:" value={order.orderNumber} />
          <InfoRow label="Ngày phát hành:" value={formatDate(order.paidAt)} />
          <InfoRow
            label="Thanh toán:"
            value={`${PAYMENT_METHOD_LABEL[order.paymentMethod]} · ${paidAt.format('DD/MM/YYYY HH:mm')}`}
          />
          <InfoRow label="Trạng thái:" value={STATUS_TEXT[order.status]} />
        </Block>
      </div>

      <div className="mt-9 flex gap-10">
        <Block title="Thông tin người mua">
          <Line>{buyerName}</Line>
          {order.guestPhone && <Line>{order.guestPhone}</Line>}
          {!order.account && <Line>Khách vãng lai</Line>}
          {order.createdBy && order.createdBy.id !== order.account?.id && (
            <Line>Lập bởi {order.createdBy.fullName}</Line>
          )}
        </Block>
        <Block title={order.account ? 'Mã thành viên' : 'Loại khách'}>
          <Line>
            {order.account ? `sc:member:${order.account.id}` : 'Khách vãng lai, không có quyền lợi thành viên'}
          </Line>
        </Block>
      </div>

      <p className="m-0 mt-10 text-[19px]">Tổng hợp</p>
      <div className="mt-3 h-px bg-[#14130f]" />
      <SummaryRow label="Tổng giá gốc dịch vụ" value={money(order.subtotal)} />
      <SummaryRow label="Ưu đãi gói thành viên" value={money(order.membershipDiscount, '−')} />
      <SummaryRow
        label={order.coupon ? `Coupon ${order.coupon.code}` : 'Coupon'}
        value={money(order.couponDiscount, '−')}
      />
      <div className="flex items-center justify-between border-0 border-y border-solid border-[#14130f] py-4 text-[20px] font-bold">
        <span>Tổng thanh toán</span>
        <span className="tabular-nums">{formatVND(order.totalAmount)}</span>
      </div>
      {refunded > 0 && (
        <>
          <SummaryRow label="Đã hoàn về ví" value={money(refunded, '−')} />
          <SummaryRow label="Thực thu" value={money(order.totalAmount - refunded)} />
        </>
      )}

      <p className="m-0 mt-11 text-[19px]">Chi tiết dịch vụ</p>
      <p className="m-0 mt-1.5 text-[12px] text-[#7a776f] italic">
        Chi tiết đặt chỗ, lớp học và gói có thể xem lại trong mục Hóa đơn hoặc Lịch tập của tài khoản.
      </p>

      {groups.map((group) => (
        <div key={group.type} className="mt-[26px]">
          <div className="flex border-0 border-b border-solid border-[#14130f] pt-2 pb-2.5 text-[12.5px] font-bold">
            <span className="w-[300px]">{ORDER_ITEM_TYPE_LABEL[group.type]}</span>
            <span className="w-[60px]">Slot</span>
            <span className="w-[110px]">Bắt đầu</span>
            <span className="w-[110px]">Kết thúc</span>
            <span className="flex-1 text-right tabular-nums">
              {formatVND(group.items.reduce((sum, item) => sum + item.totalAmount, 0))}
            </span>
          </div>
          {group.items.map((item) => {
            const { title, detail } = describeLine(item.type, item.snapshot);
            const slot = timing(item.type, item.snapshot);
            return (
              <div
                key={item.id}
                className="flex border-0 border-b border-solid border-[#e2ddd2] py-3 text-[12.5px] text-[#3d3b35]"
              >
                <span className="w-[300px] pr-3">
                  {title}
                  {detail && group.type !== 'FACILITY_BOOKING' ? ` · ${detail}` : ''} ({priceNote(order, item)})
                </span>
                <span className="w-[60px]">{slot.slots}</span>
                <span className="w-[110px]">{slot.start}</span>
                <span className="w-[110px]">{slot.end}</span>
                <span className="flex-1 text-right tabular-nums">{formatVND(item.totalAmount)}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
