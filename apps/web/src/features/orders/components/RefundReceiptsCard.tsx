import { App, Button, Card, Modal, Space, Spin, Tag, type TableColumnsType } from 'antd';
import { Download, FileText, Printer } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Table } from '~/components/data/Table';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { checkoutService } from '~/features/checkout/services/checkout.service';
import { ORDER_ITEM_TYPE_LABEL, type Order, type OrderItem, type OrderRefund } from '~/features/checkout/types';
import { describeLine, refundedOf } from '~/features/checkout/utils';
import { formatDateTime, formatVND } from '~/lib/format';
import { describeApiError } from '~/lib/http-errors';
import { printPdf, savePdf } from '~/lib/pdf';
import { PdfReceiptCanvas } from './PdfReceiptCanvas';

type BusyAction = { id: string; action: 'preview' | 'download' | 'print' } | null;

const receiptFileName = (refund: OrderRefund) => `bien-lai-hoan-${refund.transactionCode}.pdf`;

interface RefundReceiptsCardProps {
  order: Order;
}

/** Lists every refund recorded against an order with on-demand PDF preview, download and print. */
export function RefundReceiptsCard({ order }: RefundReceiptsCardProps) {
  const { message } = App.useApp();
  const cacheRef = useRef<Map<string, Blob>>(new Map());
  const [busy, setBusy] = useState<BusyAction>(null);
  const [activeRefund, setActiveRefund] = useState<OrderRefund | null>(null);
  const [activeBlob, setActiveBlob] = useState<Blob | null>(null);

  const itemsById = useMemo(() => {
    const map = new Map<string, OrderItem>();
    for (const item of order.items) map.set(item.id, item);
    return map;
  }, [order.items]);

  const sortedRefunds = useMemo(
    () => [...order.refunds].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [order.refunds],
  );

  if (sortedRefunds.length === 0) return null;

  const fetchBlob = async (refund: OrderRefund) => {
    const cached = cacheRef.current.get(refund.id);
    if (cached) return cached;
    const blob = await checkoutService.getRefundReceiptBlob(order.id, refund.id);
    cacheRef.current.set(refund.id, blob);
    return blob;
  };

  const openPreview = async (refund: OrderRefund) => {
    setActiveRefund(refund);
    const cached = cacheRef.current.get(refund.id);
    if (cached) {
      setActiveBlob(cached);
      return;
    }
    setActiveBlob(null);
    try {
      setBusy({ id: refund.id, action: 'preview' });
      const blob = await fetchBlob(refund);
      setActiveBlob(blob);
    } catch (error) {
      message.error(describeApiError(error));
      setActiveRefund(null);
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async (refund: OrderRefund) => {
    try {
      setBusy({ id: refund.id, action: 'download' });
      const blob = await fetchBlob(refund);
      savePdf(blob, receiptFileName(refund));
    } catch (error) {
      message.error(describeApiError(error));
    } finally {
      setBusy(null);
    }
  };

  const handlePrint = async (refund: OrderRefund) => {
    try {
      setBusy({ id: refund.id, action: 'print' });
      const blob = await fetchBlob(refund);
      await printPdf(blob);
    } catch (error) {
      message.error(describeApiError(error));
    } finally {
      setBusy(null);
    }
  };

  const columns: TableColumnsType<OrderRefund> = [
    {
      title: 'Giao dịch hoàn',
      key: 'transaction',
      render: (_, refund) => {
        const item = refund.orderItemId ? itemsById.get(refund.orderItemId) : undefined;
        const line = item ? describeLine(item.type, item.snapshot) : null;
        return (
          <div className="flex flex-col gap-1 py-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[14.5px] font-semibold text-sc-ink">{refund.transactionCode}</span>
              <span className="text-[13.5px] text-sc-muted">{formatDateTime(refund.createdAt)}</span>
            </div>
            {item && line && (
              <div className="flex flex-wrap items-center gap-1.5 text-[14.5px]">
                <Tag className="!m-0">{ORDER_ITEM_TYPE_LABEL[item.type]}</Tag>
                <span className="font-semibold text-sc-ink">{line.title}</span>
                {line.detail && <span className="text-sc-muted">· {line.detail}</span>}
              </div>
            )}
            {refund.reason && <span className="text-[14px] text-sc-muted">Lý do: {refund.reason}</span>}
          </div>
        );
      },
    },
    {
      title: 'Số tiền hoàn',
      key: 'amount',
      align: 'right',
      width: 145,
      render: (_, refund) => (
        <Tag color="error" className="!m-0 text-[14px] font-semibold tabular-nums">
          −{formatVND(refund.amount)}
        </Tag>
      ),
    },
    {
      title: 'Biên lai',
      key: 'actions',
      align: 'right',
      width: 250,
      render: (_, refund) => (
        <Space.Compact size="small">
          <Button
            icon={<FileText size={14} />}
            loading={busy?.id === refund.id && busy.action === 'preview'}
            onClick={() => void openPreview(refund)}
          >
            Xem biên lai
          </Button>
          <Button
            icon={<Download size={14} />}
            loading={busy?.id === refund.id && busy.action === 'download'}
            onClick={() => void handleDownload(refund)}
          >
            Tải PDF
          </Button>
          <Button
            icon={<Printer size={14} />}
            loading={busy?.id === refund.id && busy.action === 'print'}
            onClick={() => void handlePrint(refund)}
          >
            In
          </Button>
        </Space.Compact>
      ),
    },
  ];

  const totalRefunded = refundedOf(order);
  const activeItem = activeRefund?.orderItemId ? itemsById.get(activeRefund.orderItemId) : undefined;
  const activeLine = activeItem ? describeLine(activeItem.type, activeItem.snapshot) : null;

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <SectionTitle>Lịch sử hoàn tiền & biên lai</SectionTitle>
          <span className="mb-4 text-[14px] font-medium text-sc-muted">
            {sortedRefunds.length} giao dịch · Tổng hoàn{' '}
            <b className="text-red-600 tabular-nums">−{formatVND(totalRefunded)}</b>
          </span>
        </div>
        <Table<OrderRefund> rowKey="id" columns={columns} dataSource={sortedRefunds} pagination={false} />
      </Card>

      <Modal
        open={activeRefund !== null}
        onCancel={() => {
          setActiveRefund(null);
          setActiveBlob(null);
        }}
        width={900}
        centered
        destroyOnHidden
        title={
          activeRefund ? (
            <div className="flex flex-wrap items-center gap-2 pr-6">
              <span>Biên lai hoàn tiền</span>
              <Tag className="!m-0 font-mono">{activeRefund.transactionCode}</Tag>
              <Tag color="error" className="!m-0 font-semibold tabular-nums">
                −{formatVND(activeRefund.amount)}
              </Tag>
            </div>
          ) : (
            'Biên lai hoàn tiền'
          )
        }
        footer={
          activeRefund
            ? [
                <Button
                  key="close"
                  onClick={() => {
                    setActiveRefund(null);
                    setActiveBlob(null);
                  }}
                >
                  Đóng
                </Button>,
                <Button
                  key="download"
                  icon={<Download size={15} />}
                  loading={busy?.id === activeRefund.id && busy.action === 'download'}
                  disabled={!activeBlob}
                  onClick={() => void handleDownload(activeRefund)}
                >
                  Tải PDF
                </Button>,
                <Button
                  key="print"
                  type="primary"
                  icon={<Printer size={15} />}
                  loading={busy?.id === activeRefund.id && busy.action === 'print'}
                  disabled={!activeBlob}
                  onClick={() => void handlePrint(activeRefund)}
                >
                  In biên lai
                </Button>,
              ]
            : null
        }
      >
        {activeRefund && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sc-border-soft bg-stone-50 px-3.5 py-2 text-[14px] text-sc-muted">
            <div className="flex flex-wrap items-center gap-1.5">
              {activeItem && activeLine ? (
                <>
                  <Tag className="!m-0">{ORDER_ITEM_TYPE_LABEL[activeItem.type]}</Tag>
                  <span className="font-semibold text-sc-ink">{activeLine.title}</span>
                  {activeRefund.reason && <span>· {activeRefund.reason}</span>}
                </>
              ) : (
                <span>{activeRefund.reason ?? 'Hoàn tiền về ví hội viên'}</span>
              )}
            </div>
            <span className="tabular-nums">{formatDateTime(activeRefund.createdAt)}</span>
          </div>
        )}
        {activeBlob ? (
          <PdfReceiptCanvas blob={activeBlob} />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-sc-border-soft bg-stone-100/80 py-20">
            <Spin size="large" />
            <span className="text-sm text-sc-muted">Đang tải biên lai hoàn tiền PDF...</span>
          </div>
        )}
      </Modal>
    </>
  );
}
