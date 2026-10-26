import { Card, Table, Tag, type TableColumnsType } from 'antd';
import { ErrorState, PageLoading } from '~/components/feedback/States';
import { MappedTag } from '~/components/ui/MappedTag';
import { PageHeader } from '~/components/ui/PageHeader';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { ORDER_STATUS_TAG, PAYMENT_METHOD_LABEL } from '~/constants/payment';
import { QuoteTotals } from '~/features/checkout/components/QuoteTotals';
import { checkoutService } from '~/features/checkout/services/checkout.service';
import { ORDER_ITEM_TYPE_LABEL, type Order, type OrderItem } from '~/features/checkout/types';
import { describeLine, refundedOf } from '~/features/checkout/utils';
import { useReceiptPdf } from '~/hooks/useReceiptPdf';
import { formatDateTime, formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useOrder } from '../hooks/useOrders';
import { ReceiptPdfActions, ReceiptPdfPreview } from './ReceiptPdf';

/** The order's lines; refunds are read from `order.refunds` (one per refunded line, BR_3.7). */
const columnsOf = (order: Order): TableColumnsType<OrderItem> => {
  const columns: TableColumnsType<OrderItem> = [
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
      render: (_, item) => {
        const { title, detail } = describeLine(item.type, item.snapshot);
        return (
          <div className="flex flex-col gap-1.5 py-1">
            <Tag className="!m-0 self-start">{ORDER_ITEM_TYPE_LABEL[item.type]}</Tag>
            <span className="text-[18px] font-bold text-sc-ink [overflow-wrap:anywhere]">{title}</span>
            {detail && <span className="text-[15.5px] leading-relaxed text-sc-muted">{detail}</span>}
          </div>
        );
      },
    },
    {
      title: 'Thành tiền',
      key: 'total',
      align: 'right',
      render: (_, item) => (
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
      ),
    },
    {
      title: 'Đã hoàn',
      key: 'refunded',
      align: 'right',
      width: 95,
      render: (_, item) => {
        const value = refundedOf(order, item.id);
        return value ? (
          <Tag color={value >= item.totalAmount ? 'error' : 'warning'} className="!m-0 font-medium">
            −{formatVND(value)}
          </Tag>
        ) : (
          <span className="text-sc-muted-2">—</span>
        );
      },
    },
  ];
  return refundedOf(order) > 0 ? columns : columns.filter((column) => column.key !== 'refunded');
};

function toTotals(order: Order) {
  return {
    items: [],
    coupons: order.coupons.map(({ code, discount }) => ({
      code,
      discount,
      valid: true,
      applied: true,
      lineNumbers: [],
    })),
    subtotal: order.subtotal,
    membershipDiscount: order.membershipDiscount,
    couponDiscount: order.couponDiscount,
    total: order.totalAmount,
    walletBalance: null,
    canCheckout: false,
  };
}

interface OrderDetailViewProps {
  orderId: string;
  back: { to: '/orders' | '/reception/orders'; label: string };
}

export function OrderDetailView({ orderId, back }: OrderDetailViewProps) {
  const order = useOrder(orderId);
  const pdf = useReceiptPdf(() => checkoutService.getReceiptBlob(orderId));

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
  const buyer = data.account?.fullName ?? data.guestName ?? '—';
  const refunded = refundedOf(data);

  return (
    <>
      <PageHeader
        title={`Đơn hàng ${data.orderNumber}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <MappedTag value={data.status} map={ORDER_STATUS_TAG} />
            <span>{formatDateTime(data.paidAt)}</span>
            <span>{PAYMENT_METHOD_LABEL[data.paymentMethod]}</span>
          </span>
        }
        back={back}
        extra={<ReceiptPdfActions pdf={pdf} fileName={`hoa-don-${data.orderNumber}.pdf`} />}
      />

      {pdf.showPdf ? (
        <ReceiptPdfPreview pdf={pdf} />
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <SectionTitle>Dịch vụ</SectionTitle>
            <Table<OrderItem>
              rowKey="id"
              columns={columnsOf(data)}
              dataSource={data.items}
              pagination={false}
              scroll={{ x: 'max-content' }}
            />
          </Card>
          <div className="flex flex-col gap-4">
            <Card>
              <SectionTitle>Thanh toán</SectionTitle>
              <div className="mb-3 flex flex-col gap-1.5 border-b border-sc-border-soft pb-3 text-[15px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sc-muted">Người mua</span>
                  <span className="flex items-center gap-2 font-semibold text-sc-ink">
                    {!data.account && (
                      <Tag color="orange" className="!m-0">
                        Khách vãng lai
                      </Tag>
                    )}
                    {buyer}
                  </span>
                </div>
                {data.guestPhone && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sc-muted">Số điện thoại</span>
                    <span className="tabular-nums">{data.guestPhone}</span>
                  </div>
                )}
                {data.createdBy && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sc-muted">Lập bởi</span>
                    <span>{data.createdBy.fullName}</span>
                  </div>
                )}
              </div>
              <QuoteTotals quote={toTotals(data)} />
              {refunded > 0 && (
                <div className="mt-3 flex items-center justify-between rounded-lg border border-red-200/80 bg-red-50/70 px-3 py-2 text-[14.5px] text-red-700">
                  <span className="font-medium">Đã hoàn về ví</span>
                  <span className="font-bold tabular-nums">−{formatVND(refunded)}</span>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
