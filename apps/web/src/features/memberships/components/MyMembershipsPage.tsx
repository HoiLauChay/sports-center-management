import { Link } from '@tanstack/react-router';
import { Alert, Button, Card, Popconfirm, Progress, Switch, Table, Tag, type TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import type { ReactNode } from 'react';
import { EmptyState, ErrorState, PageLoading } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { PATHS } from '~/constants/paths';
import { formatDate, formatVND, VN_TIMEZONE } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useMyMemberships } from '../hooks/useMyMemberships';
import type { MemberMembership, MembershipPeriod } from '../types';
import { MembershipBenefits } from './MembershipBenefits';

const STATUS = {
  ACTIVE: { label: 'Đang hoạt động', color: 'green' },
  EXPIRED: { label: 'Hết hạn', color: 'red' },
  CANCELLED: { label: 'Đã hủy', color: 'volcano' },
} as const;

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-sc-border-soft py-3 text-sm last:border-b-0">
      <span className="text-sc-muted">{label}</span>
      <span className="min-w-0 text-right font-semibold [overflow-wrap:anywhere]">{children}</span>
    </div>
  );
}

type PeriodRow = MembershipPeriod & { packageName: string };

const historyColumns: TableColumnsType<MemberMembership> = [
  { title: 'Gói', render: (_, membership) => membership.package.name },
  { title: 'Từ', dataIndex: 'startDate', render: formatDate },
  { title: 'Đến', dataIndex: 'endDate', render: formatDate },
  {
    title: 'Trạng thái',
    dataIndex: 'status',
    render: (status: MemberMembership['status']) => <Tag color={STATUS[status].color}>{STATUS[status].label}</Tag>,
  },
];

const periodColumns: TableColumnsType<PeriodRow> = [
  { title: 'Gói', dataIndex: 'packageName' },
  {
    title: 'Kỳ đã mua',
    render: (_, period) => `${formatDate(period.periodStart)} → ${formatDate(period.periodEnd)}`,
  },
  { title: 'Đã thanh toán', dataIndex: 'paidAmount', render: formatVND },
];

export function MyMembershipsPage() {
  const { query, autoRenew, cancel } = useMyMemberships();
  const current = query.data?.current;
  const busy = autoRenew.isPending || cancel.isPending;
  const today = dayjs().tz(VN_TIMEZONE).format('YYYY-MM-DD');
  const isEffective = Boolean(
    current && current.status === 'ACTIVE' && current.startDate <= today && today < current.endDate,
  );
  const displayStatus = current?.status === 'ACTIVE' && today >= current.endDate ? 'EXPIRED' : current?.status;
  const daysLeft = current ? Math.max(0, dayjs(current.endDate).diff(dayjs(today), 'day')) : 0;
  const totalDays = current ? Math.max(1, dayjs(current.endDate).diff(dayjs(current.startDate), 'day')) : 1;
  const latestPeriod = current?.periods.reduce<MembershipPeriod | null>(
    (latest, period) => (!latest || period.periodStart > latest.periodStart ? period : latest),
    null,
  );
  const benefits = isEffective ? current?.currentBenefits : null;
  const totalSlots = benefits?.freeBookingSlotsPerMonth ?? 0;
  const usedSlots = current?.freeSlotsUsedThisMonth ?? 0;
  const slotsLeft = Math.max(0, totalSlots - usedSlots);
  const allMemberships = query.data
    ? [...(current ? [current] : []), ...query.data.history.filter(({ id }) => id !== current?.id)]
    : [];
  const periods = allMemberships
    .flatMap((membership) => membership.periods.map((period) => ({ ...period, packageName: membership.package.name })))
    .sort((a, b) => b.periodStart.localeCompare(a.periodStart));
  const error = query.error ? toApiError(query.error) : null;

  return (
    <>
      <PageHeader
        title="Gói của tôi"
        description="Thông tin gói thành viên hiện tại và lịch sử gia hạn."
        extra={
          <Link to={PATHS.memberships}>
            <Button type="primary">{current ? 'Gia hạn' : 'Đăng ký gói'}</Button>
          </Link>
        }
      />
      {query.isPending ? (
        <PageLoading />
      ) : error && !query.data ? (
        <ErrorState
          message={
            error.status === 404
              ? 'Chức năng gói của tôi đang được hoàn thiện. Bạn có thể xem các gói thành viên hiện có.'
              : error.message
          }
          onRetry={() => void query.refetch()}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {error && (
            <Alert
              type="error"
              showIcon
              title={error.message}
              action={<Button onClick={() => void query.refetch()}>Thử lại</Button>}
            />
          )}
          <div className="grid items-start gap-5 lg:grid-cols-2">
            {current ? (
              <Card
                title="Gói hiện tại"
                extra={displayStatus && <Tag color={STATUS[displayStatus].color}>{STATUS[displayStatus].label}</Tag>}
              >
                <div>
                  <InfoRow label="Gói">{current.package.name}</InfoRow>
                  {latestPeriod && <InfoRow label="Giá">{formatVND(latestPeriod.paidAmount)}</InfoRow>}
                  <InfoRow label="Bắt đầu">{formatDate(current.startDate)}</InfoRow>
                  <InfoRow label="Hết hạn">{formatDate(current.endDate)}</InfoRow>
                  {benefits && (
                    <InfoRow label="Ưu đãi thuê sân">
                      {benefits.bookingDiscountPct > 0 ? `Giảm ${benefits.bookingDiscountPct}% mọi sân` : 'Không có'}
                    </InfoRow>
                  )}
                </div>
                <div className="mt-4">
                  <div className="mb-3 text-sm text-sc-muted">Quyền lợi</div>
                  {benefits ? (
                    <MembershipBenefits benefits={benefits} />
                  ) : (
                    <EmptyState title="Không có quyền lợi đang hiệu lực" />
                  )}
                  <Progress
                    percent={Math.min(100, Math.round((daysLeft / totalDays) * 100))}
                    showInfo={false}
                    strokeColor="var(--sc-primary)"
                    className="!mt-4 !mb-0"
                  />
                  <div className="text-xs text-sc-muted">
                    Còn {daysLeft} ngày / {totalDays} ngày
                  </div>
                </div>
                {benefits && totalSlots > 0 && (
                  <div className="mt-4 border-t border-sc-border-soft pt-4 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-sc-muted">Slot sân miễn phí tháng này</span>
                      <strong>
                        {slotsLeft}/{totalSlots} còn lại
                      </strong>
                    </div>
                    <p className="mt-1 mb-0 text-xs text-sc-muted">Đã dùng {usedSlots} slot.</p>
                  </div>
                )}
                <div className="mt-4 border-t border-sc-border-soft pt-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <strong>Tự động gia hạn</strong>
                    <Switch
                      aria-label="Tự động gia hạn gói thành viên"
                      checked={current.autoRenew}
                      loading={autoRenew.isPending}
                      disabled={busy || !isEffective}
                      onChange={(enabled) => autoRenew.mutate({ membershipId: current.id, enabled })}
                    />
                  </div>
                  <p className="mb-4 text-sm text-sc-muted">
                    Khi đến hạn, hệ thống dùng số dư ví để gia hạn cùng gói. Nếu ví không đủ tiền hoặc gói ngừng bán,
                    gói sẽ không tự gia hạn.
                  </p>
                  <Popconfirm
                    title="Hủy gói? Quyền lợi dừng ngay, không hoàn tiền."
                    description="Tự động gia hạn cũng sẽ tắt."
                    okText="Hủy gói"
                    cancelText="Không"
                    okButtonProps={{ danger: true }}
                    styles={{ container: { maxWidth: 340 } }}
                    disabled={busy || !isEffective}
                    onConfirm={() => cancel.mutateAsync(current.id).catch(() => undefined)}
                  >
                    <Button danger loading={cancel.isPending} disabled={busy || !isEffective}>
                      Hủy gói thành viên
                    </Button>
                  </Popconfirm>
                  <p className="mt-2 mb-0 text-xs text-sc-muted">Hủy gói sẽ dừng quyền lợi ngay và không hoàn tiền.</p>
                </div>
              </Card>
            ) : (
              <Card>
                <EmptyState
                  title="Bạn chưa có gói đang hiệu lực"
                  description="Bạn vẫn có thể đặt sân và đăng ký lớp theo giá thông thường. Xem các gói để chọn quyền lợi phù hợp."
                  action={
                    <Link to={PATHS.memberships}>
                      <Button type="primary">Xem danh sách gói</Button>
                    </Link>
                  }
                />
              </Card>
            )}
            <div className="flex flex-col gap-5">
              <Card title="Lịch sử gói">
                <Table<MemberMembership>
                  rowKey="id"
                  dataSource={allMemberships}
                  columns={historyColumns}
                  scroll={{ x: 'max-content' }}
                  pagination={allMemberships.length > 10 ? { pageSize: 10 } : false}
                  locale={{ emptyText: <EmptyState title="Chưa có lịch sử gói" /> }}
                />
              </Card>
              <Card title="Các kỳ đã mua">
                <Table<PeriodRow>
                  rowKey="orderItemId"
                  dataSource={periods}
                  columns={periodColumns}
                  scroll={{ x: 'max-content' }}
                  pagination={periods.length > 10 ? { pageSize: 10 } : false}
                  locale={{ emptyText: <EmptyState title="Chưa có kỳ đã mua" /> }}
                  expandable={{ expandedRowRender: (period) => <MembershipBenefits benefits={period.benefits} /> }}
                />
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
