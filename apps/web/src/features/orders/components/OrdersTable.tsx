import type { Paginated } from '@sports-center/shared';
import { Tag, type TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { DataTable } from '~/components/data/DataTable';
import { Highlight } from '~/components/ui/Highlight';
import { MappedTag } from '~/components/ui/MappedTag';
import { ORDER_STATUS_TAG, PAYMENT_METHOD_LABEL } from '~/constants/payment';
import { ORDER_ITEM_TYPE_LABEL, type Order } from '~/features/checkout/types';
import { refundedOf } from '~/features/checkout/utils';
import { formatVND, VN_TIMEZONE } from '~/lib/format';

interface OrdersTableProps {
  data: Paginated<Order> | undefined;
  isLoading: boolean;
  error?: unknown;
  onRetry?: () => void;
  page: number;
  limit: number;
  onPageChange: (page: number, limit: number) => void;
  showBuyer?: boolean;
  onOpen: (order: Order) => void;
  keyword?: string;
}

export function OrdersTable({ showBuyer = false, onOpen, keyword, ...table }: OrdersTableProps) {
  const columns: TableColumnsType<Order> = [
    {
      title: 'Mã đơn',
      dataIndex: 'orderNumber',
      width: 180,
      render: (value: string) => (
        <span className="font-mono text-[13px] font-semibold text-sc-ink" title={value}>
          <Highlight keyword={keyword}>{value}</Highlight>
        </span>
      ),
    },
    {
      title: 'Thời gian',
      dataIndex: 'paidAt',
      width: 120,
      render: (value: string) => {
        const dt = dayjs(value).tz(VN_TIMEZONE);
        return (
          <div className="flex flex-col leading-tight">
            <span className="text-sc-ink tabular-nums">{dt.format('HH:mm')}</span>
            <span className="text-[13px] text-sc-muted tabular-nums">{dt.format('DD/MM/YYYY')}</span>
          </div>
        );
      },
    },
    ...(showBuyer
      ? [
          {
            title: 'Người mua',
            key: 'buyer',
            width: 180,
            render: (_: unknown, order: Order) =>
              order.account ? (
                <span className="font-medium text-sc-ink block truncate max-w-[170px]" title={order.account.fullName}>
                  <Highlight keyword={keyword}>{order.account.fullName}</Highlight>
                </span>
              ) : (
                <div className="flex flex-col gap-0.5 text-[13px]">
                  <div className="flex items-center gap-1.5">
                    <Tag color="orange" className="!m-0">
                      Khách
                    </Tag>
                    <span className="font-medium text-sc-ink truncate max-w-[120px]" title={order.guestName ?? ''}>
                      <Highlight keyword={keyword}>{order.guestName ?? ''}</Highlight>
                    </span>
                  </div>
                  {order.guestPhone && (
                    <span className="text-[13px] text-sc-muted">
                      <Highlight keyword={keyword}>{order.guestPhone}</Highlight>
                    </span>
                  )}
                </div>
              ),
          },
        ]
      : []),
    {
      title: 'Dịch vụ',
      key: 'items',
      render: (_, order) => (
        <div className="flex flex-wrap gap-1">
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
      width: 120,
      render: (value: number) => <span className="tabular-nums text-sc-ink whitespace-nowrap">{formatVND(value)}</span>,
    },
    {
      title: 'Thanh toán',
      dataIndex: 'paymentMethod',
      width: 110,
      render: (method: Order['paymentMethod']) => (
        <span className="whitespace-nowrap">{PAYMENT_METHOD_LABEL[method]}</span>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 140,
      render: (_, order) => (
        <div className="flex flex-col items-start gap-0.5">
          <MappedTag value={order.status} map={ORDER_STATUS_TAG} />
          {refundedOf(order) > 0 && (
            <span className="text-[13px] text-sc-error font-medium">Đã hoàn {formatVND(refundedOf(order))}</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable<Order>
      columns={columns}
      emptyTitle="Chưa có đơn hàng"
      emptyDescription="Đơn hàng xuất hiện sau mỗi lần thanh toán thành công."
      rowClassName="cursor-pointer hover:bg-slate-50/70 transition-colors"
      onRow={(order) => ({ onClick: () => onOpen(order) })}
      scroll={{ x: 'max-content' }}
      {...table}
    />
  );
}
