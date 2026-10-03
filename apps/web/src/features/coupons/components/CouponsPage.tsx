import { Alert, Button, Card, Popconfirm, Progress, Space, Switch, Table, Tag, type TableColumnsType } from 'antd';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { ORDER_ITEM_TYPE_LABEL } from '~/features/checkout/types';
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

export function CouponsPage() {
  const coupons = useCoupons();
  const { toggle, remove } = useCouponMutations();
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const openForm = (coupon: Coupon | null) => {
    setEditing(coupon);
    setFormOpen(true);
  };

  const columns: TableColumnsType<Coupon> = [
    {
      title: 'Mã',
      key: 'code',
      render: (_, coupon) => {
        const state = STATE_TAG[couponState(coupon)];
        return (
          <div className="flex min-w-44 flex-col gap-1">
            <b className="font-mono text-[14px]">{coupon.code}</b>
            <span className="text-[13px] text-sc-muted">{coupon.name}</span>
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
          <b className="tabular-nums">
            {coupon.discountType === 'PERCENT' ? `${coupon.discountValue}%` : formatVND(coupon.discountValue)}
          </b>
          {coupon.maxDiscount !== null && (
            <span className="text-xs text-sc-muted">tối đa {formatVND(coupon.maxDiscount)}</span>
          )}
        </div>
      ),
    },
    {
      title: 'Hiệu lực',
      key: 'valid',
      render: (_, coupon) => (
        <div className="flex flex-col text-[13px] whitespace-nowrap">
          <span>{formatDateTime(coupon.validFrom)}</span>
          <span className="text-sc-muted">→ {formatDateTime(coupon.validTo)}</span>
        </div>
      ),
    },
    {
      title: 'Áp dụng',
      key: 'types',
      render: (_, coupon) =>
        coupon.applicableTypes ? (
          <div className="flex max-w-56 flex-wrap gap-1">
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
      title: 'Ngưỡng tối thiểu',
      dataIndex: 'minOrderAmount',
      align: 'right',
      render: (value: number | null) =>
        value ? <span className="whitespace-nowrap tabular-nums">{formatVND(value)}</span> : '—',
    },
    {
      title: 'Lượt dùng',
      key: 'uses',
      width: 180,
      render: (_, coupon) => (
        <div className="min-w-32">
          {coupon.maxUses === null ? (
            <span className="tabular-nums">{coupon.usedCount} / không giới hạn</span>
          ) : (
            <Progress
              percent={Math.min(100, Math.round((coupon.usedCount / coupon.maxUses) * 100))}
              size="small"
              format={() => `${coupon.usedCount}/${coupon.maxUses}`}
            />
          )}
          <div className="text-xs text-sc-muted">{coupon.maxUsesPerUser} lượt / người</div>
        </div>
      ),
    },
    {
      title: 'Bật',
      key: 'isActive',
      render: (_, coupon) => (
        <Switch
          checked={coupon.isActive}
          aria-label={`Bật mã ${coupon.code}`}
          loading={toggle.isPending && toggle.variables.id === coupon.id}
          disabled={remove.isPending}
          onChange={(isActive) => toggle.mutate({ id: coupon.id, isActive })}
        />
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'right',
      render: (_, coupon) => (
        <Space>
          <Button size="small" onClick={() => openForm(coupon)}>
            Sửa
          </Button>
          <Popconfirm
            title={`Xóa mã ${coupon.code}?`}
            description="Đơn đã dùng mã này vẫn giữ nguyên thông tin giảm giá."
            okText="Xóa mã"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            styles={{ container: { maxWidth: 320 } }}
            onConfirm={() => remove.mutateAsync(coupon).catch(() => undefined)}
          >
            <Button size="small" danger loading={remove.isPending && remove.variables.id === coupon.id}>
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Mã giảm giá"
        description="Mã nhập khi thanh toán · mỗi đơn một mã · không áp cho nạp ví · lượt dùng đếm theo đơn."
        extra={
          <Button type="primary" icon={<Plus size={16} />} onClick={() => openForm(null)}>
            Tạo mã
          </Button>
        }
      />
      <Card>
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
            columns={columns}
            dataSource={coupons.data}
            loading={coupons.isFetching}
            scroll={{ x: 1100 }}
            pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: true }}
            locale={{ emptyText: coupons.isPending ? ' ' : <EmptyState title="Chưa có mã giảm giá" /> }}
          />
        )}
      </Card>
      <CouponFormModal open={formOpen} coupon={editing} onClose={() => setFormOpen(false)} />
    </>
  );
}
