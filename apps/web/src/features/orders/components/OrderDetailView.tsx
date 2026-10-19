import { Link } from '@tanstack/react-router';
import { App, Button, Card, Segmented, Spin, Table, Tag, type TableColumnsType } from 'antd';
import { ArrowLeft, Download, FileText, LayoutGrid, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ErrorState, PageLoading } from '~/components/feedback/States';
import { MappedTag } from '~/components/ui/MappedTag';
import { PageHeader } from '~/components/ui/PageHeader';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { ORDER_STATUS_TAG, PAYMENT_METHOD_LABEL } from '~/constants/payment';
import { QuoteTotals } from '~/features/checkout/components/QuoteTotals';
import { checkoutService } from '~/features/checkout/services/checkout.service';
import { ORDER_ITEM_TYPE_LABEL, type Order, type OrderItem } from '~/features/checkout/types';
import { describeLine, refundedOf } from '~/features/checkout/utils';
import { formatDateTime, formatVND } from '~/lib/format';
import { describeApiError, toApiError } from '~/lib/http-errors';
import { useOrder } from '../hooks/useOrders';
import { PdfReceiptCanvas } from './PdfReceiptCanvas';

/** The order's lines; refunds are read from `order.refunds` (one per refunded line, BR_3.7). */
const columnsOf = (order: Order): TableColumnsType<OrderItem> => [
  {
    title: '#',
    dataIndex: 'lineNumber',
    width: 40,
    align: 'center',
    render: (val: number) => <span className="text-xs font-medium text-sc-muted">{val}</span>,
  },
  {
    title: 'Dịch vụ',
    key: 'service',
    render: (_, item) => {
      const { title, detail } = describeLine(item.type, item.snapshot);
      return (
        <div className="flex flex-col gap-1 py-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <Tag className="!m-0 text-xs">{ORDER_ITEM_TYPE_LABEL[item.type]}</Tag>
            <b className="text-sc-ink [overflow-wrap:anywhere]">{title}</b>
          </div>
          {detail && <span className="text-[12.5px] leading-relaxed text-sc-muted">{detail}</span>}
        </div>
      );
    },
  },
  {
    title: 'Giá gốc',
    dataIndex: 'subtotal',
    align: 'right',
    width: 95,
    render: (value: number) => <span className="whitespace-nowrap tabular-nums text-sc-ink-2">{formatVND(value)}</span>,
  },
  {
    title: 'Ưu đãi gói',
    dataIndex: 'membershipDiscount',
    align: 'right',
    width: 95,
    render: (value: number) =>
      value ? (
        <span className="whitespace-nowrap font-medium text-sc-success tabular-nums">−{formatVND(value)}</span>
      ) : (
        <span className="text-sc-muted-2">—</span>
      ),
  },
  {
    title: 'Mã giảm giá',
    dataIndex: 'couponDiscount',
    align: 'right',
    width: 95,
    render: (value: number) =>
      value ? (
        <span className="whitespace-nowrap font-medium text-sc-success tabular-nums">−{formatVND(value)}</span>
      ) : (
        <span className="text-sc-muted-2">—</span>
      ),
  },
  {
    title: 'Thành tiền',
    dataIndex: 'totalAmount',
    align: 'right',
    width: 105,
    render: (value: number) => <b className="whitespace-nowrap tabular-nums text-sc-ink">{formatVND(value)}</b>,
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
  const { message } = App.useApp();
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [viewMode, setViewMode] = useState<'details' | 'pdf'>('details');
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

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

  const loadPdf = async () => {
    if (pdfBlob) return pdfBlob;
    try {
      setLoadingPdf(true);
      const blob = await checkoutService.getReceiptBlob(data.id);
      const url = URL.createObjectURL(blob);
      setPdfBlob(blob);
      setPdfUrl(url);
      return blob;
    } catch (error) {
      message.error(describeApiError(error));
      return null;
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleToggleView = async (mode?: 'details' | 'pdf') => {
    const target = mode ?? (viewMode === 'pdf' ? 'details' : 'pdf');
    setViewMode(target);
    if (target === 'pdf') {
      await loadPdf();
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      await checkoutService.downloadReceipt(data.id, data.orderNumber, pdfBlob);
    } catch (error) {
      message.error(describeApiError(error));
    } finally {
      setDownloading(false);
    }
  };

  const handlePrintPdf = async () => {
    try {
      setPrinting(true);
      await checkoutService.printReceipt(data.id);
    } catch (error) {
      message.error(describeApiError(error));
    } finally {
      setPrinting(false);
    }
  };

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
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={viewMode}
          onChange={(val) => void handleToggleView(val as 'details' | 'pdf')}
          options={[
            {
              value: 'details',
              label: (
                <span className="flex items-center gap-1.5 px-3 py-1 font-medium">
                  <LayoutGrid size={15} />
                  Chi tiết đơn hàng
                </span>
              ),
            },
            {
              value: 'pdf',
              label: (
                <span className="flex items-center gap-1.5 px-3 py-1 font-medium">
                  <FileText size={15} />
                  Bản in hóa đơn (PDF)
                </span>
              ),
            },
          ]}
          className="!p-1 bg-sc-paper-2"
        />

        <div className="flex flex-wrap items-center gap-2">
          <Link to={back.to}>
            <Button icon={<ArrowLeft size={16} />}>{back.label}</Button>
          </Link>
          <Button icon={<Download size={16} />} loading={downloading} onClick={() => void handleDownloadPdf()}>
            Tải PDF
          </Button>
          <Button type="primary" icon={<Printer size={16} />} loading={printing} onClick={() => void handlePrintPdf()}>
            In hóa đơn
          </Button>
        </div>
      </div>

      {viewMode === 'pdf' ? (
        loadingPdf ? (
          <Card className="flex h-[750px] items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Spin size="large" />
              <span className="text-sm text-sc-muted">Đang tải hóa đơn PDF...</span>
            </div>
          </Card>
        ) : (
          <div className="flex justify-center">
            <PdfReceiptCanvas blob={pdfBlob} className="w-full max-w-4xl" />
          </div>
        )
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <SectionTitle>Dịch vụ</SectionTitle>
            <Table<OrderItem>
              rowKey="id"
              size="middle"
              columns={columnsOf(data)}
              dataSource={data.items}
              pagination={false}
              scroll={{ x: 600 }}
            />
          </Card>
          <div className="flex flex-col gap-4">
            <Card>
              <SectionTitle>Người mua</SectionTitle>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-semibold text-sc-ink">{buyer}</span>
                  {!data.account && (
                    <Tag color="orange" className="!m-0">
                      Khách vãng lai
                    </Tag>
                  )}
                </div>
                {data.guestPhone && (
                  <div className="flex items-center gap-1.5 text-xs text-sc-muted">
                    <span>Số ĐT:</span>
                    <span className="font-mono font-medium text-sc-ink-2">{data.guestPhone}</span>
                  </div>
                )}
                {data.createdBy && (
                  <div className="mt-1 border-t border-sc-border-soft pt-2 text-xs text-sc-muted-2">
                    Lập bởi <span className="font-medium text-sc-ink-2">{data.createdBy.fullName}</span>
                  </div>
                )}
              </div>
            </Card>
            <Card>
              <SectionTitle>Thanh toán</SectionTitle>
              <QuoteTotals quote={toTotals(data)} />
              {refunded > 0 && (
                <div className="mt-3 flex items-center justify-between rounded-lg border border-red-200/80 bg-red-50/70 px-3 py-2 text-xs text-red-700">
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
