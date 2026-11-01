import { getRouteApi, Link } from '@tanstack/react-router';
import { Card, Tag, type TableColumnsType } from 'antd';
import { Table } from '~/components/data/Table';
import { ErrorState, PageLoading } from '~/components/feedback/States';
import { MoneyFigure } from '~/components/ui/MoneyFigure';
import { PageHeader } from '~/components/ui/PageHeader';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { checkoutService } from '~/features/checkout/services/checkout.service';
import { ORDER_ITEM_TYPE_LABEL, type OrderItem, type OrderRefund } from '~/features/checkout/types';
import { describeLine } from '~/features/checkout/utils';
import { useReceiptPdf } from '~/hooks/useReceiptPdf';
import { formatDateTime, formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useOrder } from '../hooks/useOrders';
import { ReceiptPdfActions, ReceiptPdfPreview } from './ReceiptPdf';

export type OrderRouteBase = '/orders' | '/reception/orders' | '/admin/orders';

interface RefundLineRow {
  key: string;
  lineNumber: number;
  item: OrderItem | null;
  refund: OrderRefund;
}

const refundColumns: TableColumnsType<RefundLineRow> = [
  {
    title: '#',
    dataIndex: 'lineNumber',
    width: 56,
    render: (val: number) => (
      <span className="font-display text-[22px] font-extrabold text-sc-muted-2">{String(val).padStart(2, '0')}</span>
    ),
  },
  {
    title: 'Dịch vụ',
    key: 'service',
    render: (_, { item, refund }) => {
      const line = item ? describeLine(item.type, item.snapshot) : null;
      return (
        <div className="flex flex-col gap-1.5 py-1">
          <Tag className="!m-0 self-start">{item ? ORDER_ITEM_TYPE_LABEL[item.type] : 'Hoàn tiền đơn hàng'}</Tag>
          <span className="text-[18px] font-bold text-sc-ink [overflow-wrap:anywhere]">
            {line ? line.title : `Hoàn tiền giao dịch ${refund.transactionCode}`}
          </span>
          {line?.detail && <span className="text-[15.5px] leading-relaxed text-sc-muted">{line.detail}</span>}
          {refund.reason && <span className="text-[14.5px] text-sc-muted">Lý do hoàn: {refund.reason}</span>}
        </div>
      );
    },
  },
  {
    title: 'Thành tiền',
    key: 'total',
    align: 'right',
    render: (_, { item, refund }) => {
      if (!item) {
        return (
          <span className="text-[16px] font-semibold whitespace-nowrap text-sc-ink tabular-nums">
            {formatVND(refund.amount)}
          </span>
        );
      }
      return (
        <div className="flex flex-col items-end gap-0.5 tabular-nums">
          <span className="text-[16px] font-semibold whitespace-nowrap text-sc-ink">{formatVND(item.totalAmount)}</span>
          {(item.membershipDiscount > 0 || item.couponDiscount > 0) && (
            <span className="text-[14.5px] whitespace-nowrap text-sc-muted line-through">
              {formatVND(item.subtotal)}
            </span>
          )}
          {item.membershipDiscount > 0 && (
            <span className="text-[14.5px] whitespace-nowrap text-sc-success">
              Ưu đãi gói −{formatVND(item.membershipDiscount)}
            </span>
          )}
          {item.couponDiscount > 0 && (
            <span className="text-[14.5px] whitespace-nowrap text-sc-success">
              Mã giảm giá −{formatVND(item.couponDiscount)}
            </span>
          )}
        </div>
      );
    },
  },
  {
    title: 'Đã hoàn',
    key: 'refunded',
    align: 'right',
    width: 115,
    render: (_, { refund }) => (
      <Tag color="success" className="!m-0 font-medium tabular-nums">
        +{formatVND(refund.amount)}
      </Tag>
    ),
  },
];

interface RefundDetailViewProps {
  orderId: string;
  refundId: string;
  base: OrderRouteBase;
}

/** Full-page refund receipt view matching `OrderDetailView` layout and inline PDF print preview. */
export function RefundDetailView({ orderId, refundId, base }: RefundDetailViewProps) {
  const order = useOrder(orderId);
  const pdf = useReceiptPdf(() => checkoutService.getRefundReceiptBlob(orderId, refundId));

  if (order.isPending) return <PageLoading />;
  if (order.isError) {
    const apiError = toApiError(order.error);
    return (
      <ErrorState
        message={apiError.status === 404 ? 'Không tìm thấy hóa đơn.' : apiError.message}
        onRetry={apiError.status === 404 ? undefined : () => void order.refetch()}
      />
    );
  }

  const data = order.data;
  const refund = data.refunds.find((entry) => entry.id === refundId);
  if (!refund) {
    return <ErrorState message="Không tìm thấy biên lai hoàn tiền." />;
  }

  const item = refund.orderItemId ? (data.items.find((entry) => entry.id === refund.orderItemId) ?? null) : null;
  const buyer = data.account?.fullName ?? data.guestName ?? '—';
  const originalSubtotal = item ? item.subtotal : refund.amount;
  const itemDiscount = item ? item.membershipDiscount + item.couponDiscount : 0;
  const itemPaid = item ? item.totalAmount : refund.amount;

  const rows: RefundLineRow[] = [
    {
      key: refund.id,
      lineNumber: item?.lineNumber ?? 1,
      item,
      refund,
    },
  ];

  return (
    <>
      <PageHeader
        title={`Biên lai hoàn ${refund.transactionCode}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <Tag color="success" className="!m-0">
              Đã hoàn về ví
            </Tag>
            <span>{formatDateTime(refund.createdAt)}</span>
            <span>Ví</span>
          </span>
        }
        back={{
          to: `${base}/$orderId`,
          params: { orderId: data.id },
          label: `Đơn hàng ${data.orderNumber}`,
        }}
        extra={<ReceiptPdfActions pdf={pdf} fileName={`bien-lai-hoan-${refund.transactionCode}.pdf`} />}
      />

      {pdf.showPdf ? (
        <ReceiptPdfPreview pdf={pdf} />
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-4">
            <Card>
              <SectionTitle>Dịch vụ</SectionTitle>
              <Table<RefundLineRow> rowKey="key" columns={refundColumns} dataSource={rows} pagination={false} />
            </Card>
          </div>

          <div className="flex flex-col gap-4">
            <Card>
              <SectionTitle>Thanh toán</SectionTitle>
              <div className="mb-3 flex flex-col gap-1.5 border-b border-sc-border-soft pb-3 text-[15px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sc-muted">Người nhận</span>
                  <span className="font-semibold text-sc-ink">{buyer}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sc-muted">Thuộc đơn</span>
                  <Link
                    to={`${base}/$orderId`}
                    params={{ orderId: data.id }}
                    className="font-mono font-semibold text-sc-primary hover:underline"
                  >
                    {data.orderNumber}
                  </Link>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sc-muted">Mã giao dịch</span>
                  <span className="font-mono tabular-nums">{refund.transactionCode}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sc-muted">Hình thức</span>
                  <span>Hoàn về ví</span>
                </div>
              </div>

              <div className="flex flex-col text-[15px]">
                <div className="divide-y divide-sc-border-soft">
                  <div className="flex items-center justify-between gap-4 py-2">
                    <span className="text-sc-ink-2">Giá gốc dịch vụ</span>
                    <span className="whitespace-nowrap font-medium text-sc-ink tabular-nums">
                      {formatVND(originalSubtotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2">
                    <span className="text-sc-ink-2">Ưu đãi đã áp dụng</span>
                    <span
                      className={`whitespace-nowrap tabular-nums ${
                        itemDiscount > 0 ? 'font-medium text-sc-success' : 'text-sc-muted'
                      }`}
                    >
                      {itemDiscount > 0 ? `−${formatVND(itemDiscount)}` : '0 đ'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2">
                    <span className="text-sc-ink-2">Đã thu trên đơn</span>
                    <span className="whitespace-nowrap font-medium text-sc-ink tabular-nums">
                      {formatVND(itemPaid)}
                    </span>
                  </div>
                </div>

                <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-sc-border pt-3">
                  <span className="text-[15px] font-semibold text-sc-ink">Đã hoàn về ví</span>
                  <span className="whitespace-nowrap font-display text-[22px] font-extrabold text-sc-success tabular-nums">
                    +<MoneyFigure amount={refund.amount} />
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

const memberRefundRoute = getRouteApi('/_authenticated/_member/orders_/$orderId/refunds/$refundId');
const receptionRefundRoute = getRouteApi('/_authenticated/_receptionist/reception/orders_/$orderId/refunds/$refundId');
const adminRefundRoute = getRouteApi('/_authenticated/_manager/admin/orders_/$orderId/refunds/$refundId');

export function MemberRefundDetailPage() {
  const { orderId, refundId } = memberRefundRoute.useParams();
  return <RefundDetailView orderId={orderId} refundId={refundId} base="/orders" />;
}

export function ReceptionRefundDetailPage() {
  const { orderId, refundId } = receptionRefundRoute.useParams();
  return <RefundDetailView orderId={orderId} refundId={refundId} base="/reception/orders" />;
}

export function AdminRefundDetailPage() {
  const { orderId, refundId } = adminRefundRoute.useParams();
  return <RefundDetailView orderId={orderId} refundId={refundId} base="/admin/orders" />;
}
