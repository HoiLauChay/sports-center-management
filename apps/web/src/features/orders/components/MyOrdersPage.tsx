import type { OrderStatus } from '@sports-center/shared';
import { useNavigate } from '@tanstack/react-router';
import { Card, Segmented } from 'antd';
import { useState } from 'react';
import { DateRangeFilter, type DateRange } from '~/components/form/DateRangeFilter';
import { SearchInput } from '~/components/form/SearchInput';
import { PageHeader } from '~/components/ui/PageHeader';
import { ORDER_STATUS_TAG } from '~/constants/payment';
import { DEFAULT_PAGE_SIZE } from '~/lib/search';
import { useOrders } from '../hooks/useOrders';
import { OrdersTable } from './OrdersTable';

export function MyOrdersPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [orderNumber, setOrderNumber] = useState('');
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const [range, setRange] = useState<DateRange>({});
  const orders = useOrders({
    page,
    limit,
    status,
    orderNumber: orderNumber.trim() || undefined,
    from: range.from,
    to: range.to,
  });

  return (
    <>
      <PageHeader title="Đơn hàng của tôi" />
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchInput
            placeholder="Tìm theo mã đơn..."
            value={orderNumber}
            onChange={(value) => {
              setOrderNumber(value);
              setPage(1);
            }}
            className="w-full sm:!w-64"
          />
          <DateRangeFilter
            value={range}
            onChange={(value) => {
              setRange(value);
              setPage(1);
            }}
          />
          <div className="max-w-full overflow-x-auto">
            <Segmented
              value={status ?? 'ALL'}
              onChange={(value) => {
                setStatus(value === 'ALL' ? undefined : (value as OrderStatus));
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Tất cả' },
                ...(Object.keys(ORDER_STATUS_TAG) as OrderStatus[]).map((value) => ({
                  value,
                  label: ORDER_STATUS_TAG[value].label,
                })),
              ]}
            />
          </div>
        </div>
        <OrdersTable
          data={orders.data}
          isLoading={orders.isFetching}
          error={orders.error}
          onRetry={() => void orders.refetch()}
          page={page}
          limit={limit}
          keyword={orderNumber}
          onPageChange={(nextPage, nextLimit) => {
            setPage(nextLimit === limit ? nextPage : 1);
            setLimit(nextLimit);
          }}
          onOpen={(order) => void navigate({ to: '/orders/$orderId', params: { orderId: order.id } })}
        />
      </Card>
    </>
  );
}
