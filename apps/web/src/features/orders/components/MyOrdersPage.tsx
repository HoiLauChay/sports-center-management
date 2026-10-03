import { useNavigate } from '@tanstack/react-router';
import { Card, Select } from 'antd';
import { useState } from 'react';
import { PageHeader } from '~/components/ui/PageHeader';
import { ORDER_STATUS_TAG } from '~/constants/payment';
import type { OrderStatus } from '~/features/checkout/types';
import { DEFAULT_PAGE_SIZE } from '~/lib/search';
import { useOrders } from '../hooks/useOrders';
import { OrdersTable } from './OrdersTable';

export function MyOrdersPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const orders = useOrders({ page, limit, status });

  return (
    <>
      <PageHeader title="Hóa đơn của tôi" description="Mọi lần mua đặt sân, lớp học và gói thành viên của bạn." />
      <Card>
        <Select
          allowClear
          placeholder="Mọi trạng thái"
          className="mb-4 w-full sm:!w-56"
          value={status}
          onChange={(value: OrderStatus | undefined) => {
            setStatus(value);
            setPage(1);
          }}
          options={(Object.keys(ORDER_STATUS_TAG) as OrderStatus[]).map((value) => ({
            value,
            label: ORDER_STATUS_TAG[value].label,
          }))}
        />
        <OrdersTable
          data={orders.data}
          isLoading={orders.isFetching}
          error={orders.error}
          onRetry={() => void orders.refetch()}
          page={page}
          limit={limit}
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
