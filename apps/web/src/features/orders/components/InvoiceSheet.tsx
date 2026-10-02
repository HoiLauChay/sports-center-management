import { PAYMENT_METHOD_LABEL } from '~/constants/payment';
import { ORDER_ITEM_TYPE_LABEL, type Order } from '~/features/checkout/types';
import { describeLine } from '~/features/checkout/utils';
import { formatDateTime, formatVND } from '~/lib/format';

const STATUS_STAMP = {
  PAID: 'ĐÃ THANH TOÁN',
  PARTIALLY_REFUNDED: 'ĐÃ HOÀN MỘT PHẦN',
  REFUNDED: 'ĐÃ HOÀN TOÀN BỘ',
} as const;

/**
 * The printable invoice / receipt, built only from the order's frozen snapshot (BR_3.4). It is invisible on screen
 * and is what the browser prints (or saves as PDF) from the "In" / "Tải PDF" buttons.
 */
export function InvoiceSheet({ order }: { order: Order }) {
  const buyerName = order.account?.fullName ?? order.guestName ?? '—';
  return (
    <div className="print-sheet hidden bg-white p-8 text-[13px] text-black print:block">
      <div className="flex items-start justify-between gap-6 border-b-2 border-black pb-4">
        <div>
          <div className="text-[22px] font-extrabold tracking-wide uppercase">Sports Center</div>
          <div className="text-[12px]">Hệ thống quản lý trung tâm thể thao</div>
        </div>
        <div className="text-right">
          <div className="text-[18px] font-extrabold uppercase">Hóa đơn</div>
          <div className="font-mono text-[14px] font-bold">{order.orderNumber}</div>
          <div>{formatDateTime(order.paidAt)}</div>
          <div className="mt-1 inline-block border border-black px-2 py-0.5 text-[11px] font-bold">
            {STATUS_STAMP[order.status]}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1">
        <div>
          <span className="text-neutral-600">Người mua: </span>
          <b>{buyerName}</b>
        </div>
        <div>
          <span className="text-neutral-600">Hình thức thanh toán: </span>
          <b>{PAYMENT_METHOD_LABEL[order.paymentMethod]}</b>
        </div>
        {order.guestPhone && (
          <div>
            <span className="text-neutral-600">Số điện thoại: </span>
            <b>{order.guestPhone}</b>
          </div>
        )}
        {order.createdBy && (
          <div>
            <span className="text-neutral-600">Người lập: </span>
            <b>{order.createdBy.fullName}</b>
          </div>
        )}
        {order.coupon && (
          <div>
            <span className="text-neutral-600">Mã giảm giá: </span>
            <b>{order.coupon.code}</b>
          </div>
        )}
      </div>

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="border-y border-black bg-neutral-100 text-left">
            <th className="w-10 px-2 py-1.5 text-center">STT</th>
            <th className="px-2 py-1.5">Dịch vụ</th>
            <th className="px-2 py-1.5 text-right">Giá gốc</th>
            <th className="px-2 py-1.5 text-right">Ưu đãi gói</th>
            <th className="px-2 py-1.5 text-right">Mã giảm</th>
            <th className="px-2 py-1.5 text-right">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => {
            const { title, detail } = describeLine(item.type, item.snapshot);
            return (
              <tr key={item.id} className="border-b border-neutral-300 align-top">
                <td className="px-2 py-1.5 text-center">{item.lineNumber}</td>
                <td className="px-2 py-1.5">
                  <b>{title}</b>
                  <div className="text-[12px] text-neutral-600">
                    {ORDER_ITEM_TYPE_LABEL[item.type]}
                    {detail && ` · ${detail}`}
                    {item.refundedAmount > 0 && ` · đã hoàn ${formatVND(item.refundedAmount)}`}
                  </div>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatVND(item.subtotal)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {item.membershipDiscount ? `−${formatVND(item.membershipDiscount)}` : '—'}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {item.couponDiscount ? `−${formatVND(item.couponDiscount)}` : '—'}
                </td>
                <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{formatVND(item.totalAmount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-3 ml-auto w-72">
        <div className="flex justify-between py-0.5">
          <span>Tạm tính</span>
          <span className="tabular-nums">{formatVND(order.subtotal)}</span>
        </div>
        <div className="flex justify-between py-0.5">
          <span>Ưu đãi gói thành viên</span>
          <span className="tabular-nums">−{formatVND(order.membershipDiscount)}</span>
        </div>
        <div className="flex justify-between py-0.5">
          <span>Mã giảm giá</span>
          <span className="tabular-nums">−{formatVND(order.couponDiscount)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t-2 border-black py-1.5 text-[16px] font-extrabold">
          <span>Tổng thanh toán</span>
          <span className="tabular-nums">{formatVND(order.totalAmount)}</span>
        </div>
        {order.refundedAmount > 0 && (
          <div className="flex justify-between py-0.5">
            <span>Đã hoàn</span>
            <span className="tabular-nums">−{formatVND(order.refundedAmount)}</span>
          </div>
        )}
      </div>

      <div className="mt-6 text-[11.5px] leading-relaxed text-neutral-600">
        Hóa đơn được dựng từ thông tin chốt tại thời điểm thanh toán và không thay đổi; hoàn tiền được ghi nhận riêng
        từng dịch vụ. Gói thành viên không hoàn tiền.
      </div>
      <div className="mt-10 grid grid-cols-2 text-center">
        <div>
          <b>Người mua</b>
          <div className="mt-12">{buyerName}</div>
        </div>
        <div>
          <b>Người lập</b>
          <div className="mt-12">{order.createdBy?.fullName ?? 'Hệ thống'}</div>
        </div>
      </div>
    </div>
  );
}
