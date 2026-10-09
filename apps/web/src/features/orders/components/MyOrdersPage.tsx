import { useNavigate } from '@tanstack/react-router';
import { Card } from 'antd';
import { useState } from 'react';
import { PageHeader } from '~/components/ui/PageHeader';
import { DEFAULT_PAGE_SIZE } from '~/lib/search';
import { useOrders } from '../hooks/useOrders';
import { OrdersTable } from './OrdersTable';

export function MyOrdersPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  // `GET /me/orders` filters by date only, so there is no status filter here.
  const orders = useOrders({ page, limit });

  return (
    <>
      <PageHeader title="Hóa đơn của tôi" description="Mọi lần mua đặt sân, lớp học và gói thành viên của bạn." />
      <Card>
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
