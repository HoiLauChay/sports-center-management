import { Link } from '@tanstack/react-router';
import { Alert, Button, Card, Collapse, Popconfirm, Progress, Tag } from 'antd';
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
  ENDING: { label: 'Đã hủy, còn hạn', color: 'orange' },
} as const;

const statusOf = (membership: MemberMembership) =>
  membership.status === 'ACTIVE' && membership.cancelledAt ? 'ENDING' : membership.status;

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-sc-border-soft py-3 text-[15px] last:border-b-0">
      <span className="text-sc-muted">{label}</span>
      <span className="min-w-0 text-right font-semibold [overflow-wrap:anywhere]">{children}</span>
    </div>
  );
}

type PeriodRow = MembershipPeriod & { packageName: string };

function HistoryList({ memberships }: { memberships: MemberMembership[] }) {
  if (!memberships.length) return <EmptyState title="Chưa có lịch sử gói" />;
  return (
    <ul className="m-0 list-none p-0">
      {memberships.map((membership) => {
        const status = statusOf(membership);
        return (
          <li
            key={membership.id}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-sc-border-soft py-3 first:pt-0 last:border-b-0 last:pb-0"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-semibold">{membership.package.name}</span>
              <span className="text-[14.5px] text-sc-muted tabular-nums">
                {formatDate(membership.startDate)} → {formatDate(membership.endDate)}
              </span>
            </div>
            <Tag color={STATUS[status].color} className="!m-0">
              {STATUS[status].label}
            </Tag>
          </li>
        );
      })}
    </ul>
  );
}

function PeriodList({ periods }: { periods: PeriodRow[] }) {
  if (!periods.length) return <EmptyState title="Chưa có kỳ đã mua" />;
  return (
    <Collapse
      ghost
      expandIconPlacement="end"
      items={periods.map((period) => ({
        key: period.orderItemId,
        label: (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-semibold">{period.packageName}</span>
              <span className="text-[14.5px] text-sc-muted tabular-nums">
                {formatDate(period.periodStart)} → {formatDate(period.periodEnd)}
              </span>
            </div>
            <span className="tabular-nums">{formatVND(period.paidAmount)}</span>
          </div>
        ),
        children: <MembershipBenefits benefits={period.benefits} />,
      }))}
    />
  );
}

export function MyMembershipsPage() {
  const { query, cancel } = useMyMemberships();
  const current = query.data?.current;
  const today = dayjs().tz(VN_TIMEZONE).format('YYYY-MM-DD');
  const isEffective = Boolean(
    current && current.status === 'ACTIVE' && current.startDate <= today && today < current.endDate,
  );
  const displayStatus =
    current && (current.status === 'ACTIVE' && today >= current.endDate ? 'EXPIRED' : statusOf(current));
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
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-2">
            {current ? (
              <Card
                title="Gói hiện tại"
                extra={displayStatus && <Tag color={STATUS[displayStatus].color}>{STATUS[displayStatus].label}</Tag>}
              >
                <div>
                  <InfoRow label="Gói">{current.package.name}</InfoRow>
                  {latestPeriod && <InfoRow label="Đã trả kỳ gần nhất">{formatVND(latestPeriod.paidAmount)}</InfoRow>}
                  <InfoRow label="Bắt đầu">{formatDate(current.startDate)}</InfoRow>
                  <InfoRow label="Hết hạn">{formatDate(current.endDate)}</InfoRow>
                  {benefits && (
                    <InfoRow label="Ưu đãi thuê sân">
                      {benefits.bookingDiscountPct > 0 ? `Giảm ${benefits.bookingDiscountPct}% mọi sân` : 'Không có'}
                    </InfoRow>
                  )}
                </div>
                <div className="mt-4">
                  <div className="mb-3 text-[15px] text-sc-muted">Quyền lợi</div>
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
                  <div className="text-[14.5px] text-sc-muted">
                    Còn {daysLeft} ngày / {totalDays} ngày
                  </div>
                </div>
                {benefits && totalSlots > 0 && (
                  <div className="mt-4 border-t border-sc-border-soft pt-4 text-[15px]">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-sc-muted">Slot sân miễn phí tháng này</span>
                      <strong>
                        {slotsLeft}/{totalSlots} còn lại
                      </strong>
                    </div>
                    <p className="mt-1 mb-0 text-[14.5px] text-sc-muted">Đã dùng {usedSlots} slot.</p>
                  </div>
                )}
                <div className="mt-4 border-t border-sc-border-soft pt-4">
                  {current.cancelledAt ? (
                    <p className="mb-0 text-[15px] text-sc-muted">
                      Gói đã hủy và sẽ không gia hạn. Bạn vẫn dùng quyền lợi đến {formatDate(current.endDate)}. Mua lại
                      cùng gói trước ngày này để tiếp tục.
                    </p>
                  ) : (
                    <>
                      <p className="mb-4 text-[15px] text-sc-muted">
                        Khi đến hạn, hệ thống dùng số dư ví để gia hạn cùng gói. Nếu ví không đủ tiền hoặc gói ngừng
                        bán, gói sẽ không tự gia hạn.
                      </p>
                      <Popconfirm
                        title="Hủy gói? Gói sẽ không gia hạn, không hoàn tiền."
                        description={`Bạn vẫn dùng quyền lợi đến ${formatDate(current.endDate)}.`}
                        okText="Hủy gói"
                        cancelText="Không"
                        okButtonProps={{ danger: true }}
                        styles={{ container: { maxWidth: 340 } }}
                        disabled={cancel.isPending || !isEffective}
                        onConfirm={() => cancel.mutateAsync(current.id).catch(() => undefined)}
                      >
                        <Button danger loading={cancel.isPending} disabled={cancel.isPending || !isEffective}>
                          Hủy gói thành viên
                        </Button>
                      </Popconfirm>
                    </>
                  )}
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
                <HistoryList memberships={allMemberships} />
              </Card>
              <Card title="Các kỳ đã mua" styles={{ body: { padding: '8px 8px 12px' } }}>
                <PeriodList periods={periods} />
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
