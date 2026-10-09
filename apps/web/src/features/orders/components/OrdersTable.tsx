import type { Paginated } from '@sports-center/shared';
import { Button, Tag, type TableColumnsType } from 'antd';
import { DataTable } from '~/components/data/DataTable';
import { MappedTag } from '~/components/ui/MappedTag';
import { ORDER_STATUS_TAG, PAYMENT_METHOD_LABEL } from '~/constants/payment';
import { ORDER_ITEM_TYPE_LABEL, type Order } from '~/features/checkout/types';
import { refundedOf } from '~/features/checkout/utils';
import { formatDateTime, formatVND } from '~/lib/format';

interface OrdersTableProps {
  data: Paginated<Order> | undefined;
  isLoading: boolean;
  error?: unknown;
  onRetry?: () => void;
  page: number;
  limit: number;
  onPageChange: (page: number, limit: number) => void;
  /** Staff see who bought; members only see their own orders. */
  showBuyer?: boolean;
  onOpen: (order: Order) => void;
}

export function OrdersTable({ showBuyer = false, onOpen, ...table }: OrdersTableProps) {
  const columns: TableColumnsType<Order> = [
    {
      title: 'Số hóa đơn',
      dataIndex: 'orderNumber',
      render: (value: string) => <span className="font-mono text-[13px] font-semibold whitespace-nowrap">{value}</span>,
    },
    {
      title: 'Thời gian',
      dataIndex: 'paidAt',
      render: (value: string) => <span className="whitespace-nowrap">{formatDateTime(value)}</span>,
    },
    ...(showBuyer
      ? [
          {
            title: 'Người mua',
            key: 'buyer',
            render: (_: unknown, order: Order) =>
              order.account ? (
                order.account.fullName
              ) : (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <Tag className="!m-0">Khách</Tag>
                  {order.guestName}
                  {order.guestPhone && <span className="text-sc-muted">· {order.guestPhone}</span>}
                </span>
              ),
          },
        ]
      : []),
    {
      title: 'Dịch vụ',
      key: 'items',
      render: (_, order) => (
        <div className="flex max-w-60 flex-wrap gap-1">
          {order.items.map((item) => (
            <Tag key={item.id} className="!m-0">
              {ORDER_ITEM_TYPE_LABEL[item.type]}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'totalAmount',
      align: 'right',
      render: (value: number) => <b className="whitespace-nowrap tabular-nums">{formatVND(value)}</b>,
    },
    {
      title: 'Thanh toán',
      dataIndex: 'paymentMethod',
      render: (method: Order['paymentMethod']) => PAYMENT_METHOD_LABEL[method],
    },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_, order) => (
        <div className="flex flex-col items-start gap-0.5">
          <MappedTag value={order.status} map={ORDER_STATUS_TAG} />
          {refundedOf(order) > 0 && (
            <span className="text-xs text-sc-error">Đã hoàn {formatVND(refundedOf(order))}</span>
          )}
        </div>
      ),
    },
    {
      title: '',
      key: 'open',
      align: 'right',
      render: (_, order) => (
        <Button size="small" onClick={() => onOpen(order)}>
          Xem
        </Button>
      ),
    },
  ];

  return (
    <DataTable<Order>
      columns={columns}
      emptyTitle="Chưa có hóa đơn"
      emptyDescription="Hóa đơn xuất hiện sau mỗi lần thanh toán thành công."
      rowClassName="cursor-pointer"
      onRow={(order) => ({ onClick: () => onOpen(order) })}
      {...table}
    />
  );
}
