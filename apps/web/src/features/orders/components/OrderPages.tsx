import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { Card, DatePicker, Input, Select } from 'antd';
import type { Dayjs } from 'dayjs';
import { useState } from 'react';
import { PageHeader } from '~/components/ui/PageHeader';
import { ORDER_STATUS_TAG } from '~/constants/payment';
import type { OrderStatus } from '~/features/checkout/types';
import { DEFAULT_PAGE_SIZE } from '~/lib/search';
import { DATE_FORMAT } from '~/lib/time';
import { useOrders } from '../hooks/useOrders';
import { OrderDetailView } from './OrderDetailView';
import { OrdersTable } from './OrdersTable';

const memberDetail = getRouteApi('/_authenticated/_member/orders/$orderId');
const receptionDetail = getRouteApi('/_authenticated/_receptionist/reception/orders/$orderId');

export function MemberOrderDetailPage() {
  const { orderId } = memberDetail.useParams();
  return <OrderDetailView orderId={orderId} back={{ to: '/orders', label: 'Hóa đơn của tôi' }} />;
}

export function ReceptionOrderDetailPage() {
  const { orderId } = receptionDetail.useParams();
  return <OrderDetailView orderId={orderId} back={{ to: '/reception/orders', label: 'Danh sách hóa đơn' }} />;
}

/** `/reception/orders`: look up any order by number, guest phone, status or date. */
export function ReceptionOrdersPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [term, setTerm] = useState('');
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  const looksLikePhone = /^\+?\d{6,}$/.test(term);
  const orders = useOrders({
    page,
    limit,
    status,
    orderNumber: term && !looksLikePhone ? term : undefined,
    guestPhone: term && looksLikePhone ? term : undefined,
    from: range?.[0]?.format(DATE_FORMAT),
    to: range?.[1]?.format(DATE_FORMAT),
  });

  const reset = () => setPage(1);

  return (
    <>
      <PageHeader
        title="Hóa đơn"
        description="Tra cứu hóa đơn theo số hóa đơn hoặc số điện thoại khách, xem và in lại biên lai."
      />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <Input.Search
            allowClear
            placeholder="Số hóa đơn hoặc SĐT khách"
            className="w-full sm:!w-72"
            onSearch={(value) => {
              setTerm(value.trim());
              reset();
            }}
          />
          <Select
            allowClear
            placeholder="Mọi trạng thái"
            className="w-full sm:!w-48"
            value={status}
            onChange={(value: OrderStatus | undefined) => {
              setStatus(value);
              reset();
            }}
            options={(Object.keys(ORDER_STATUS_TAG) as OrderStatus[]).map((value) => ({
              value,
              label: ORDER_STATUS_TAG[value].label,
            }))}
          />
          <DatePicker.RangePicker
            format="DD/MM/YYYY"
            onChange={(value) => {
              setRange(value);
              reset();
            }}
          />
        </div>
        <OrdersTable
          showBuyer
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
          onOpen={(order) => void navigate({ to: '/reception/orders/$orderId', params: { orderId: order.id } })}
        />
      </Card>
    </>
  );
}
