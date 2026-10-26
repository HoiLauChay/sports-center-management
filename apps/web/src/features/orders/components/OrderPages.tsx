import { ORDER_SERVICES, type OrderService } from '@sports-center/shared';
import { getRouteApi } from '@tanstack/react-router';
import { Card, DatePicker, Select, Tag } from 'antd';
import type { Dayjs } from 'dayjs';
import { useState } from 'react';
import { SearchInput } from '~/components/form/SearchInput';
import { PageHeader } from '~/components/ui/PageHeader';
import { ORDER_STATUS_TAG } from '~/constants/payment';
import type { OrderStatus } from '~/features/checkout/types';
import { DEFAULT_PAGE_SIZE, parseEnumSearch, parseStringSearch } from '~/lib/search';
import { DATE_FORMAT } from '~/lib/time';
import { useOrders } from '../hooks/useOrders';
import { OrderDetailView } from './OrderDetailView';
import { OrdersTable } from './OrdersTable';

export interface StaffOrdersSearch {
  memberId?: string;
  service?: OrderService;
}

export const parseStaffOrdersSearch = (search: Record<string, unknown>): StaffOrdersSearch => ({
  memberId: parseStringSearch(search.memberId),
  service: parseEnumSearch(ORDER_SERVICES, search.service),
});

const SERVICE_LABEL: Record<OrderService, string> = {
  MEMBERSHIP: 'Gói thành viên',
  BOOKING: 'Đặt sân',
  CLASS: 'Lớp học',
};

const memberDetail = getRouteApi('/_authenticated/_member/orders/$orderId');
const receptionDetail = getRouteApi('/_authenticated/_receptionist/reception/orders/$orderId');
const adminDetail = getRouteApi('/_authenticated/_manager/admin/orders/$orderId');
const receptionList = getRouteApi('/_authenticated/_receptionist/reception/orders/');
const adminList = getRouteApi('/_authenticated/_manager/admin/orders/');

export function MemberOrderDetailPage() {
  const { orderId } = memberDetail.useParams();
  return <OrderDetailView orderId={orderId} back={{ to: '/orders', label: 'Đơn hàng của tôi' }} />;
}

export function ReceptionOrderDetailPage() {
  const { orderId } = receptionDetail.useParams();
  return <OrderDetailView orderId={orderId} back={{ to: '/reception/orders', label: 'Danh sách hóa đơn' }} />;
}

export function AdminOrderDetailPage() {
  const { orderId } = adminDetail.useParams();
  return <OrderDetailView orderId={orderId} back={{ to: '/admin/orders', label: 'Danh sách hóa đơn' }} />;
}

interface StaffOrdersProps {
  base: '/reception/orders' | '/admin/orders';
  search: StaffOrdersSearch;
  onSearch: (next: StaffOrdersSearch) => void;
}

/** Orders for staff; a support request opens it already filtered to the member and the service it is about. */
function StaffOrders({ base, search, onSearch }: StaffOrdersProps) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [term, setTerm] = useState('');
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  const orders = useOrders({
    page,
    limit,
    status,
    accountId: search.memberId,
    service: search.service,
    q: term || undefined,
    from: range?.[0]?.format(DATE_FORMAT),
    to: range?.[1]?.format(DATE_FORMAT),
  });
  const memberName = orders.data?.items.find((order) => order.account)?.account?.fullName;

  const reset = () => setPage(1);

  return (
    <>
      <PageHeader title="Hóa đơn" />
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {search.memberId && (
            <Tag
              closable
              className="!m-0 !flex h-8 items-center"
              onClose={() => {
                onSearch({ ...search, memberId: undefined });
                reset();
              }}
            >
              {memberName ? `Thành viên: ${memberName}` : 'Một thành viên'}
            </Tag>
          )}
          <SearchInput
            placeholder="Số hóa đơn, người mua hoặc SĐT..."
            maxLength={100}
            className="w-full sm:!w-72"
            value={term}
            onChange={(value) => {
              setTerm(value);
              reset();
            }}
            loading={orders.isFetching}
          />
          <Select
            allowClear
            placeholder="Mọi dịch vụ"
            className="w-full sm:!w-44"
            value={search.service}
            onChange={(value: OrderService | undefined) => {
              onSearch({ ...search, service: value });
              reset();
            }}
            options={ORDER_SERVICES.map((value) => ({ value, label: SERVICE_LABEL[value] }))}
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
          keyword={term}
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
          link={(order) => ({ to: `${base}/$orderId`, params: { orderId: order.id } })}
        />
      </Card>
    </>
  );
}

export function ReceptionOrdersPage() {
  const search = receptionList.useSearch();
  const navigate = receptionList.useNavigate();
  return <StaffOrders base="/reception/orders" search={search} onSearch={(next) => void navigate({ search: next })} />;
}

export function AdminOrdersPage() {
  const search = adminList.useSearch();
  const navigate = adminList.useNavigate();
  return <StaffOrders base="/admin/orders" search={search} onSearch={(next) => void navigate({ search: next })} />;
}
