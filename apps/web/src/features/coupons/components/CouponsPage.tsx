import { Alert, Button, Card, Progress, Segmented, Switch, Table, Tag, type TableColumnsType } from 'antd';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { RowActions } from '~/components/data/RowActions';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { SearchInput } from '~/components/form/SearchInput';
import { PageHeader } from '~/components/ui/PageHeader';
import { ORDER_ITEM_TYPE_LABEL } from '~/features/checkout/types';
import { useConfirm } from '~/hooks/useConfirm';
import { formatDateTime, formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { couponState, useCouponMutations, useCoupons } from '../hooks/useCoupons';
import type { Coupon, CouponState } from '../types';
import { CouponFormModal } from './CouponFormModal';

const STATE_TAG: Record<CouponState, { label: string; color?: string }> = {
  LIVE: { label: 'Đang chạy', color: 'success' },
  SCHEDULED: { label: 'Sắp hiệu lực', color: 'processing' },
  EXPIRED: { label: 'Hết hạn' },
  USED_UP: { label: 'Hết lượt', color: 'warning' },
  OFF: { label: 'Đang tắt', color: 'error' },
};

type CouponStatusFilter = 'ALL' | CouponState;

const STATUS_OPTIONS: { value: CouponStatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'LIVE', label: 'Đang chạy' },
  { value: 'SCHEDULED', label: 'Sắp hiệu lực' },
  { value: 'EXPIRED', label: 'Hết hạn' },
  { value: 'USED_UP', label: 'Hết lượt' },
  { value: 'OFF', label: 'Đang tắt' },
];

export function CouponsPage() {
  const confirm = useConfirm();
  const coupons = useCoupons();
  const { toggle, remove } = useCouponMutations();
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<CouponStatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const openForm = (coupon: Coupon | null) => {
    setEditing(coupon);
    setFormOpen(true);
  };

  const filteredCoupons = useMemo(() => {
    if (!coupons.data) return [];
    const q = search.trim().toLowerCase();
    return coupons.data.filter((c) => {
      const st = couponState(c);
      if (statusFilter !== 'ALL' && st !== statusFilter) return false;
      if (q) {
        const matchCode = c.code.toLowerCase().includes(q);
        const matchName = c.name.toLowerCase().includes(q);
        if (!matchCode && !matchName) return false;
      }
      return true;
    });
  }, [coupons.data, statusFilter, search]);

  const columns: TableColumnsType<Coupon> = [
    {
      title: '#',
      key: 'index',
      width: 56,
      render: (_, __, index) => (
        <span className="font-display text-xl font-extrabold text-sc-muted-2">
          {String((page - 1) * pageSize + index + 1).padStart(2, '0')}
        </span>
      ),
    },
    {
      title: 'Mã',
      key: 'code',
      render: (_, coupon) => {
        const state = STATE_TAG[couponState(coupon)];
        return (
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[15px] font-semibold">{coupon.code}</span>
            <span className="line-clamp-2 w-40 text-[14.5px] text-sc-muted [overflow-wrap:anywhere]">
              {coupon.name}
            </span>
            <Tag color={state.color} className="!m-0 w-fit">
              {state.label}
            </Tag>
          </div>
        );
      },
    },
    {
      title: 'Mức giảm',
      key: 'discount',
      render: (_, coupon) => (
        <div className="flex flex-col whitespace-nowrap">
          <span className="tabular-nums">
            {coupon.discountType === 'PERCENT' ? `${coupon.discountValue}%` : formatVND(coupon.discountValue)}
          </span>
          {coupon.maxDiscount !== null && (
            <span className="text-[14.5px] text-sc-muted">tối đa {formatVND(coupon.maxDiscount)}</span>
          )}
          {coupon.minOrderAmount ? (
            <span className="text-[14.5px] text-sc-muted">đơn từ {formatVND(coupon.minOrderAmount)}</span>
          ) : null}
        </div>
      ),
    },
    {
      title: 'Hiệu lực',
      key: 'valid',
      render: (_, coupon) => (
        <div className="flex flex-col text-[14.5px] whitespace-nowrap">
          <span>{formatDateTime(coupon.validFrom)}</span>
          <span className="text-sc-muted">→ {formatDateTime(coupon.validTo)}</span>
        </div>
      ),
    },
    {
      title: 'Áp dụng',
      key: 'types',
      render: (_, coupon) =>
        coupon.applicableTypes && coupon.applicableTypes.length < 4 ? (
          <div className="flex flex-wrap gap-1">
            {coupon.applicableTypes.map((type) => (
              <Tag key={type} className="!m-0">
                {ORDER_ITEM_TYPE_LABEL[type]}
              </Tag>
            ))}
          </div>
        ) : (
          <Tag className="!m-0">Mọi dịch vụ</Tag>
        ),
    },
    {
      title: 'Lượt dùng',
      key: 'uses',
      render: (_, coupon) => (
        <div className="w-36">
          {coupon.maxUses === null ? (
            <span className="tabular-nums text-[15px]">{coupon.usedCount} lượt</span>
          ) : (
            <Progress
              percent={Math.min(100, Math.round((coupon.usedCount / coupon.maxUses) * 100))}
              size="small"
              format={() => `${coupon.usedCount}/${coupon.maxUses}`}
            />
          )}
          <div className="text-[14.5px] text-sc-muted">
            {coupon.maxUses === null && 'Không giới hạn · '}
            {coupon.maxUsesPerUser} lượt / người
          </div>
        </div>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'right',
      render: (_, coupon) => (
        <div className="flex items-center justify-end gap-3">
          <Switch
            checked={coupon.isActive}
            aria-label={`Bật mã ${coupon.code}`}
            loading={toggle.isPending && toggle.variables.id === coupon.id}
            disabled={remove.isPending}
            onChange={(isActive) => toggle.mutate({ id: coupon.id, isActive })}
          />
          <RowActions
            label={`Thao tác với mã ${coupon.code}`}
            actions={[
              { key: 'edit', label: 'Sửa', onClick: () => openForm(coupon) },
              {
                key: 'delete',
                label: 'Xóa',
                danger: true,
                loading: remove.isPending && remove.variables.id === coupon.id,
                onClick: () =>
                  confirm({
                    title: `Xóa mã ${coupon.code}?`,
                    content: 'Đơn đã dùng mã này vẫn giữ nguyên thông tin giảm giá.',
                    okText: 'Xóa mã',
                    onOk: () => remove.mutateAsync(coupon).catch(() => undefined),
                  }),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Mã giảm giá"
        extra={
          <Button type="primary" icon={<Plus size={16} />} onClick={() => openForm(null)}>
            Tạo mã
          </Button>
        }
      />
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SearchInput
            placeholder="Tìm theo mã, tên ưu đãi..."
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            className="w-full sm:!w-72"
          />
          <div className="overflow-x-auto">
            <Segmented
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val as CouponStatusFilter);
                setPage(1);
              }}
              options={STATUS_OPTIONS}
            />
          </div>
        </div>

        {coupons.error && coupons.data && (
          <Alert
            type="error"
            showIcon
            className="!mb-4"
            title={toApiError(coupons.error).message}
            action={
              <Button size="small" onClick={() => void coupons.refetch()}>
                Thử lại
              </Button>
            }
          />
        )}
        {coupons.error && !coupons.data ? (
          <ErrorState message={toApiError(coupons.error).message} onRetry={() => void coupons.refetch()} />
        ) : (
          <Table<Coupon>
            rowKey="id"
            size="middle"
            columns={columns}
            dataSource={filteredCoupons}
            loading={coupons.isFetching}
            scroll={{ x: 'max-content' }}
            pagination={{
              current: page,
              pageSize,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              showTotal: (total) => `${total} mã giảm giá`,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
            locale={{
              emptyText: coupons.isPending ? (
                ' '
              ) : (
                <EmptyState
                  title={
                    search || statusFilter !== 'ALL' ? 'Không tìm thấy mã giảm giá phù hợp' : 'Chưa có mã giảm giá'
                  }
                  description={
                    search || statusFilter !== 'ALL' ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm' : undefined
                  }
                />
              ),
            }}
          />
        )}
      </Card>
      <CouponFormModal open={formOpen} coupon={editing} onClose={() => setFormOpen(false)} />
    </>
  );
}
