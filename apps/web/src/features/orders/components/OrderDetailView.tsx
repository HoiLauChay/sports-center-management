import { Link } from '@tanstack/react-router';
import { Button, Card, Table, Tag, type TableColumnsType } from 'antd';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { useState } from 'react';
import { ErrorState, PageLoading } from '~/components/feedback/States';
import { MappedTag } from '~/components/ui/MappedTag';
import { PageHeader } from '~/components/ui/PageHeader';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { ORDER_STATUS_TAG, PAYMENT_METHOD_LABEL } from '~/constants/payment';
import { QuoteTotals } from '~/features/checkout/components/QuoteTotals';
import { checkoutService } from '~/features/checkout/services/checkout.service';
import { ORDER_ITEM_TYPE_LABEL, type Order, type OrderItem } from '~/features/checkout/types';
import { describeLine } from '~/features/checkout/utils';
import { formatDateTime, formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useOrder } from '../hooks/useOrders';
import { InvoiceSheet } from './InvoiceSheet';

const columns: TableColumnsType<OrderItem> = [
  { title: '#', dataIndex: 'lineNumber', width: 48 },
  {
    title: 'Dịch vụ',
    key: 'service',
    render: (_, item) => {
      const { title, detail } = describeLine(item.type, item.snapshot);
      return (
        <div className="flex min-w-56 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Tag className="!m-0">{ORDER_ITEM_TYPE_LABEL[item.type]}</Tag>
            <b className="[overflow-wrap:anywhere]">{title}</b>
          </div>
          {detail && <span className="text-[13px] text-sc-muted">{detail}</span>}
        </div>
      );
    },
  },
  {
    title: 'Giá gốc',
    dataIndex: 'subtotal',
    align: 'right',
    render: (value: number) => <span className="whitespace-nowrap tabular-nums">{formatVND(value)}</span>,
  },
  {
    title: 'Ưu đãi gói',
    dataIndex: 'membershipDiscount',
    align: 'right',
    render: (value: number) =>
      value ? <span className="whitespace-nowrap text-sc-success tabular-nums">−{formatVND(value)}</span> : '—',
  },
  {
    title: 'Mã giảm giá',
    dataIndex: 'couponDiscount',
    align: 'right',
    render: (value: number) =>
      value ? <span className="whitespace-nowrap text-sc-success tabular-nums">−{formatVND(value)}</span> : '—',
  },
  {
    title: 'Thành tiền',
    dataIndex: 'totalAmount',
    align: 'right',
    render: (value: number) => <b className="whitespace-nowrap tabular-nums">{formatVND(value)}</b>,
  },
  {
    title: 'Đã hoàn',
    dataIndex: 'refundedAmount',
    align: 'right',
    render: (value: number, item) =>
      value ? (
        <Tag color={value >= item.totalAmount ? 'error' : 'warning'} className="!m-0">
          −{formatVND(value)}
        </Tag>
      ) : (
        '—'
      ),
  },
];

function toTotals(order: Order) {
  return {
    items: [],
    coupon: order.coupon ? { code: order.coupon.code, valid: true, discount: order.coupon.discount } : null,
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

/**
 * Order detail with the printable invoice. "Tải PDF" saves the invoice through the browser's print dialog until
 * `GET /orders/{id}/invoice` (#114) is live; then it becomes a blob download of the server-built PDF.
 */
export function OrderDetailView({ orderId, back }: OrderDetailViewProps) {
  const order = useOrder(orderId);
  const [downloading, setDownloading] = useState(false);

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

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      await checkoutService.downloadReceipt(data.id, data.orderNumber);
    } catch {
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <div className="no-print">
        <PageHeader
          title={`Hóa đơn ${data.orderNumber}`}
          description={
            <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
              <MappedTag value={data.status} map={ORDER_STATUS_TAG} />
              <span>{formatDateTime(data.paidAt)}</span>
              <span>{PAYMENT_METHOD_LABEL[data.paymentMethod]}</span>
            </span>
          }
          extra={
            <div className="flex flex-wrap gap-2">
              <Link to={back.to}>
                <Button icon={<ArrowLeft size={16} />}>{back.label}</Button>
              </Link>
              <Button icon={<Download size={16} />} loading={downloading} onClick={() => void handleDownloadPdf()}>
                Tải PDF
              </Button>
              <Button type="primary" icon={<Printer size={16} />} onClick={() => window.print()}>
                In hóa đơn
              </Button>
            </div>
          }
        />
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <SectionTitle>Dịch vụ</SectionTitle>
            <Table<OrderItem>
              rowKey="id"
              size="middle"
              columns={columns}
              dataSource={data.items}
              pagination={false}
              scroll={{ x: 'max-content' }}
            />
          </Card>
          <div className="flex flex-col gap-4">
            <Card>
              <SectionTitle>Người mua</SectionTitle>
              <div className="flex flex-col gap-1">
                <b>{buyer}</b>
                {data.guestPhone && <span className="text-sc-muted">{data.guestPhone}</span>}
                {!data.account && <Tag className="!m-0 w-fit">Khách vãng lai</Tag>}
                {data.createdBy && <span className="text-xs text-sc-muted-2">Lập bởi {data.createdBy.fullName}</span>}
              </div>
            </Card>
            <Card>
              <SectionTitle>Thanh toán</SectionTitle>
              <QuoteTotals quote={toTotals(data)} />
              {data.refundedAmount > 0 && (
                <p className="mt-2 mb-0 text-sc-error">Đã hoàn về ví: {formatVND(data.refundedAmount)}</p>
              )}
            </Card>
          </div>
        </div>
      </div>
      <InvoiceSheet order={data} />
    </>
  );
}
