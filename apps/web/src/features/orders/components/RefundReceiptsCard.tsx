import { Link } from '@tanstack/react-router';
import { Button, Card, Tag, type TableColumnsType } from 'antd';
import { ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import { Table } from '~/components/data/Table';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { ORDER_ITEM_TYPE_LABEL, type Order, type OrderItem, type OrderRefund } from '~/features/checkout/types';
import { describeLine, refundedOf } from '~/features/checkout/utils';
import { useRowLink } from '~/hooks/useRowLink';
import { formatDateTime, formatVND } from '~/lib/format';
import type { OrderRouteBase } from './RefundDetailView';

interface RefundReceiptsCardProps {
  order: Order;
  base: OrderRouteBase;
}

/** Lists every refund recorded against an order; each row opens the dedicated refund receipt page. */
export function RefundReceiptsCard({ order, base }: RefundReceiptsCardProps) {
  const rowLink = useRowLink((refund: OrderRefund) => ({
    to: `${base}/$orderId/refunds/$refundId`,
    params: { orderId: order.id, refundId: refund.id },
  }));

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

  const columns: TableColumnsType<OrderRefund> = [
    {
      title: 'Biên lai hoàn',
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
              <div className="flex flex-col gap-0.5 text-[14.5px]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Tag className="!m-0">{ORDER_ITEM_TYPE_LABEL[item.type]}</Tag>
                  <span className="font-semibold text-sc-ink">{line.title}</span>
                </div>
                {line.detail && <span className="text-[13.5px] text-sc-muted">{line.detail}</span>}
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
      width: 150,
      render: (_, refund) => (
        <Tag color="success" className="!m-0 text-[14px] font-semibold tabular-nums">
          +{formatVND(refund.amount)}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'right',
      width: 145,
      render: (_, refund) => (
        <Link
          to={`${base}/$orderId/refunds/$refundId`}
          params={{ orderId: order.id, refundId: refund.id }}
          onClick={(event) => event.stopPropagation()}
        >
          <Button size="small" icon={<ChevronRight size={14} />} iconPlacement="end">
            Xem biên lai
          </Button>
        </Link>
      ),
    },
  ];

  const totalRefunded = refundedOf(order);

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <SectionTitle>Biên lai hoàn tiền</SectionTitle>
        <span className="mb-4 text-[14px] font-medium text-sc-muted">
          {sortedRefunds.length} biên lai · Tổng hoàn{' '}
          <b className="text-sc-success tabular-nums">+{formatVND(totalRefunded)}</b>
        </span>
      </div>
      <Table<OrderRefund> rowKey="id" columns={columns} dataSource={sortedRefunds} onRow={rowLink} pagination={false} />
    </Card>
  );
}
