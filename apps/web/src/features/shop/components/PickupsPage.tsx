import type { FulfillmentStatus, ProductSale } from '@sports-center/shared';
import { Link } from '@tanstack/react-router';
import { Button, Card, Segmented, Tag, type TableColumnsType } from 'antd';
import { PackageCheck } from 'lucide-react';
import { useState } from 'react';
import { Table } from '~/components/data/Table';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { SearchInput } from '~/components/form/SearchInput';
import { PageHeader } from '~/components/ui/PageHeader';
import { useConfirm } from '~/hooks/useConfirm';
import { formatDateTime, formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { nowVN } from '~/lib/time';
import { useProductSales, useSaleActions } from '../hooks/useShop';
import { FULFILLMENT_LABEL, timeLeftText } from '../utils';
import { ProductThumb } from './ProductThumb';

type StatusFilter = FulfillmentStatus | 'ALL';

const SOON_MS = 6 * 60 * 60 * 1000;

function Deadline({ sale }: { sale: ProductSale }) {
  if (sale.status === 'PICKED_UP') {
    return (
      <div className="flex flex-col text-[14.5px]">
        <span>{sale.pickedUpAt ? formatDateTime(sale.pickedUpAt) : '—'}</span>
        {sale.pickedUpBy && <span className="text-sc-muted">{sale.pickedUpBy.fullName}</span>}
      </div>
    );
  }
  if (sale.status === 'CANCELLED') {
    return (
      <span className="text-[14.5px] text-sc-muted">{sale.cancelledAt ? formatDateTime(sale.cancelledAt) : '—'}</span>
    );
  }
  if (!sale.pickupDeadline) return <span className="text-sc-muted">—</span>;
  const left = new Date(sale.pickupDeadline).getTime() - nowVN().valueOf();
  return (
    <div className="flex flex-col text-[14.5px]">
      <span className={left < SOON_MS ? 'font-semibold text-sc-warning' : ''}>
        {formatDateTime(sale.pickupDeadline)}
      </span>
      <span className="text-sc-muted">{timeLeftText(left)}</span>
    </div>
  );
}

/** Receptionist: hand paid online orders to members, or cancel and refund the ones never collected. */
export function PickupsPage() {
  const confirm = useConfirm();
  const [status, setStatus] = useState<StatusFilter>('PENDING_PICKUP');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const sales = useProductSales({
    status: status === 'ALL' ? undefined : status,
    q: q || undefined,
    page,
    limit: 20,
  });
  const { pickup, cancel } = useSaleActions();

  const columns: TableColumnsType<ProductSale> = [
    {
      title: 'Đơn',
      key: 'order',
      render: (_, sale) => (
        <div className="flex flex-col gap-1">
          <Link to="/reception/orders/$orderId" params={{ orderId: sale.orderId }} className="font-mono font-semibold">
            {sale.orderNumber}
          </Link>
          <Tag color={FULFILLMENT_LABEL[sale.status].color} className="!m-0 w-fit">
            {FULFILLMENT_LABEL[sale.status].label}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Khách',
      key: 'buyer',
      render: (_, sale) => (
        <div className="flex flex-col">
          <b>{sale.buyer.fullName}</b>
          {sale.buyer.phone && <span className="text-[14.5px] text-sc-muted tabular-nums">{sale.buyer.phone}</span>}
        </div>
      ),
    },
    {
      title: 'Sản phẩm',
      key: 'product',
      render: (_, sale) => (
        <div className="flex min-w-48 items-center gap-3">
          <ProductThumb imageUrl={sale.product.imageUrl} name={sale.product.name} size={40} />
          <div className="flex min-w-0 flex-col">
            <span className="font-semibold [overflow-wrap:anywhere]">
              <span className="font-display text-[17px] text-sc-primary">{sale.quantity} ×</span> {sale.product.name}
            </span>
            <span className="text-[14px] text-sc-muted tabular-nums">
              {sale.product.sku} · {formatVND(sale.totalAmount)}
            </span>
          </div>
        </div>
      ),
    },
    {
      title: status === 'PICKED_UP' ? 'Đã giao' : status === 'CANCELLED' ? 'Đã hủy' : 'Hạn nhận',
      key: 'deadline',
      render: (_, sale) => <Deadline sale={sale} />,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'right',
      render: (_, sale) =>
        sale.status === 'PENDING_PICKUP' ? (
          <div className="flex justify-end gap-2">
            <Button
              danger
              loading={cancel.isPending && cancel.variables.saleId === sale.id}
              onClick={() =>
                confirm({
                  title: `Hủy đơn ${sale.orderNumber}?`,
                  content: `${sale.quantity} × ${sale.product.name} được trả lại kho và ${formatVND(sale.totalAmount)} hoàn về ví của ${sale.buyer.fullName}.`,
                  okText: 'Hủy và hoàn tiền',
                  onOk: () => cancel.mutateAsync({ saleId: sale.id }).catch(() => undefined),
                })
              }
            >
              Hủy
            </Button>
            <Button
              type="primary"
              icon={<PackageCheck size={16} />}
              loading={pickup.isPending && pickup.variables === sale.id}
              onClick={() =>
                confirm({
                  title: `Giao ${sale.quantity} × ${sale.product.name}?`,
                  content: `Kiểm tra đúng người nhận: ${sale.buyer.fullName}${sale.buyer.phone ? ` · ${sale.buyer.phone}` : ''}.`,
                  okText: 'Đã giao hàng',
                  danger: false,
                  onOk: () => pickup.mutateAsync(sale.id).catch(() => undefined),
                })
              }
            >
              Giao hàng
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader title="Nhận hàng" description="Đơn sản phẩm thành viên đã mua online, chờ lấy tại quầy." />
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SearchInput
            placeholder="Mã đơn, tên, SĐT, sản phẩm..."
            value={q}
            onChange={(value) => {
              setQ(value);
              setPage(1);
            }}
            className="w-full sm:!w-80"
          />
          <div className="overflow-x-auto">
            <Segmented
              value={status}
              onChange={(value) => {
                setStatus(value as StatusFilter);
                setPage(1);
              }}
              options={[
                { value: 'PENDING_PICKUP', label: 'Chờ nhận' },
                { value: 'PICKED_UP', label: 'Đã giao' },
                { value: 'CANCELLED', label: 'Đã hủy' },
                { value: 'ALL', label: 'Tất cả' },
              ]}
            />
          </div>
        </div>
        {sales.error && !sales.data ? (
          <ErrorState message={toApiError(sales.error).message} onRetry={() => void sales.refetch()} />
        ) : (
          <Table<ProductSale>
            rowKey="id"
            size="middle"
            columns={columns}
            dataSource={sales.data?.items}
            loading={sales.isFetching}
            pagination={{
              current: page,
              pageSize: 20,
              total: sales.data?.total,
              onChange: setPage,
              showTotal: (total) => `${total} đơn`,
            }}
            locale={{
              emptyText: sales.isPending ? (
                ' '
              ) : (
                <EmptyState
                  title={status === 'PENDING_PICKUP' && !q ? 'Không có đơn nào đang chờ nhận' : 'Không có đơn phù hợp'}
                />
              ),
            }}
          />
        )}
      </Card>
    </>
  );
}
