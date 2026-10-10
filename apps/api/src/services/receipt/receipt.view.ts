import type { ItemSnapshotBase } from '@sports-center/shared';

import type { OrderRow } from '~/repositories/order.repository';
import { formatCenterDate, formatCenterDateTime } from '~/utils/time';

interface ReceiptSnapshot {
  orderNumber: string;
  issuedAt: string;
  issuer: { name: string; address: string; taxCode: string };
  buyer:
    | { accountId: string; fullName: string; email: string; phone: string | null; address: string | null }
    | { guest: { name: string; phone: string } };
  paymentMethod: 'WALLET' | 'CASH' | 'CARD' | 'TRANSFER';
  membership: { packageName: string } | null;
  coupons?: { code: string; name: string; discount: number }[];
  coupon?: { code: string; name: string; discount: number } | null;
}

export interface ReceiptRow {
  title: string;
  start: string;
  end: string;
  amount: number;
}

export interface ReceiptView {
  fileName: string;
  title: string;
  issuer: string[];
  infoTitle: string;
  info: [string, string][];
  buyer: string[];
  memberCode: string | null;
  summary: { label: string; amount: number; sign?: '-' }[];
  total: { label: string; amount: number };
  note?: string;
  detailTitle: string;
  amountHeader: string;
  rows: ReceiptRow[];
}

const PAYMENT_METHOD_LABEL: Record<ReceiptSnapshot['paymentMethod'], string> = {
  WALLET: 'Ví điện tử',
  CASH: 'Tiền mặt',
  CARD: 'Thẻ',
  TRANSFER: 'Chuyển khoản',
};

export const formatMoney = (amount: number) => `${amount.toLocaleString('vi-VN')} đ`;

const issuerLines = ({ issuer }: ReceiptSnapshot) => [issuer.name, issuer.address, `MST: ${issuer.taxCode}`];

const buyerLines = ({ buyer }: ReceiptSnapshot) =>
  'guest' in buyer
    ? [buyer.guest.name, buyer.guest.phone, 'Khách vãng lai']
    : [buyer.fullName, buyer.email, buyer.phone, buyer.address].filter((line): line is string => !!line);

const memberCode = ({ buyer }: ReceiptSnapshot) => ('guest' in buyer ? null : `sc:member:${buyer.accountId}`);

const itemOf = (order: OrderRow, itemId: string | null) => order.items.find(({ id }) => id === itemId);

const rowOf = (item: OrderRow['items'][number], amount: number): ReceiptRow => {
  const snapshot = item.itemSnapshot as unknown as ItemSnapshotBase;
  const subtotal = Number(item.subtotal);
  const discount = Number(item.membershipDiscountAmount) + Number(item.couponDiscountAmount);
  const detail =
    discount > 0
      ? ` (giá gốc ${formatMoney(subtotal)}${snapshot.discountPct ? `, ưu đãi gói −${snapshot.discountPct}%` : ''})`
      : '';
  return {
    title: `${snapshot.title}${detail}`,
    start: snapshot.startAt ? formatCenterDateTime(snapshot.startAt) : '—',
    end: snapshot.endAt ? formatCenterDateTime(snapshot.endAt) : '—',
    amount,
  };
};

const couponLabel = ({ coupons, coupon }: ReceiptSnapshot) => {
  const codes = (coupons ?? (coupon ? [coupon] : [])).map(({ code }) => code);
  return codes.length ? `Coupon (${codes.join(', ')})` : 'Coupon';
};

export const buildPaymentReceipt = (order: OrderRow): ReceiptView => {
  const snapshot = order.receiptSnapshot as unknown as ReceiptSnapshot;
  const membershipDiscount = Number(order.membershipDiscountAmount);
  const couponDiscount = Number(order.couponDiscountAmount);
  return {
    fileName: `bien-lai-${snapshot.orderNumber}.pdf`,
    title: `Biên lai thanh toán đơn hàng ngày ${formatCenterDate(snapshot.issuedAt)}`,
    issuer: issuerLines(snapshot),
    infoTitle: 'Thông tin biên lai',
    info: [
      ['Số biên lai:', snapshot.orderNumber],
      ['Ngày phát hành:', formatCenterDate(snapshot.issuedAt)],
      ['Thanh toán:', `${PAYMENT_METHOD_LABEL[snapshot.paymentMethod]} · ${formatCenterDateTime(snapshot.issuedAt)}`],
      ['Trạng thái:', 'Đã thanh toán'],
    ],
    buyer: buyerLines(snapshot),
    memberCode: memberCode(snapshot),
    summary: [
      { label: 'Tổng giá gốc dịch vụ', amount: Number(order.subtotal) },
      {
        label: snapshot.membership
          ? `Ưu đãi gói thành viên (${snapshot.membership.packageName})`
          : 'Ưu đãi gói thành viên',
        amount: membershipDiscount,
        sign: '-',
      },
      { label: couponLabel(snapshot), amount: couponDiscount, sign: '-' },
    ],
    total: { label: 'Tổng thanh toán', amount: Number(order.totalAmount) },
    detailTitle: 'Chi tiết dịch vụ',
    amountHeader: 'Thành tiền',
    rows: order.items.map((item) => rowOf(item, Number(item.totalAmount))),
  };
};

export const buildRefundReceipt = (order: OrderRow, refund: OrderRow['walletTransactions'][number]): ReceiptView => {
  const snapshot = order.receiptSnapshot as unknown as ReceiptSnapshot;
  const amount = Number(refund.amount);
  const item = itemOf(order, refund.orderItemId);
  return {
    fileName: `bien-lai-hoan-tien-${refund.transactionCode}.pdf`,
    title: `Biên lai hoàn tiền ngày ${formatCenterDate(refund.createdAt)}`,
    issuer: issuerLines(snapshot),
    infoTitle: 'Thông tin biên lai',
    info: [
      ['Số biên lai:', refund.transactionCode],
      ['Thuộc đơn:', snapshot.orderNumber],
      ['Ngày hoàn:', formatCenterDateTime(refund.createdAt)],
      ['Hình thức:', 'Hoàn về ví'],
      ['Người thực hiện:', refund.createdBy?.fullName ?? 'Hệ thống'],
    ],
    buyer: buyerLines(snapshot),
    memberCode: memberCode(snapshot),
    summary: [],
    total: { label: 'Số tiền hoàn', amount },
    note: refund.description ? `Lý do: ${refund.description}` : undefined,
    detailTitle: 'Dịch vụ được hoàn',
    amountHeader: 'Số tiền hoàn',
    rows: item ? [rowOf(item, amount)] : [],
  };
};
