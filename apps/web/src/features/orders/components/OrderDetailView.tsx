import { App, Button, Card, Space, Spin, Table, Tag, type TableColumnsType } from 'antd';
import { Download, FileText, LayoutGrid, Printer } from 'lucide-react';
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
        back={back}
        extra={
          <Space.Compact>
            <Button
              icon={viewMode === 'pdf' ? <LayoutGrid size={16} /> : <FileText size={16} />}
              onClick={() => void handleToggleView()}
            >
              {viewMode === 'pdf' ? 'Xem chi tiết' : 'Xem bản in'}
            </Button>
            <Button icon={<Download size={16} />} loading={downloading} onClick={() => void handleDownloadPdf()}>
              Tải PDF
            </Button>
            <Button icon={<Printer size={16} />} loading={printing} onClick={() => void handlePrintPdf()}>
              In hóa đơn
            </Button>
          </Space.Compact>
        }
      />

      {viewMode === 'pdf' ? (
        loadingPdf ? (
          <Card className="flex h-[750px] items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Spin size="large" />
              <span className="text-[15px] text-sc-muted">Đang tải hóa đơn PDF...</span>
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
