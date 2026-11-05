import { Link } from '@tanstack/react-router';
import { Alert, Button, Collapse } from 'antd';
import dayjs from 'dayjs';
import { useState, type ReactNode } from 'react';
import { EmptyState, ErrorState, PageLoading } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { PATHS } from '~/constants/paths';
import { formatDate, formatVND, VN_TIMEZONE } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useMyMemberships } from '../hooks/useMyMemberships';
import type { MemberMembership, MembershipPeriod } from '../types';
import { EndMembershipModal } from './EndMembershipModal';
import { MembershipBenefits } from './MembershipBenefits';

const STATUS = {
  ACTIVE: { label: 'Đang hoạt động', tone: 'bg-sc-primary-soft text-sc-primary' },
  EXPIRED: { label: 'Hết hạn', tone: 'bg-red-50 text-sc-error' },
  CANCELLED: { label: 'Đã hủy', tone: 'bg-sc-paper-2 text-sc-muted' },
  ENDING: { label: 'Đã hủy, còn hạn', tone: 'bg-sc-accent-soft text-sc-accent' },
} as const;

const statusOf = (membership: MemberMembership) =>
  membership.status === 'ACTIVE' && membership.cancelledAt ? 'ENDING' : membership.status;

function StatusTag({ status }: { status: keyof typeof STATUS }) {
  return (
    <span
      className={`shrink-0 rounded-md px-2 py-0.5 text-[13px] font-semibold whitespace-nowrap ${STATUS[status].tone}`}
    >
      {STATUS[status].label}
    </span>
  );
}

function Panel({ title, className = '', children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-sc-border bg-sc-surface p-5 md:p-6 ${className}`}>
      <h2 className="m-0 mb-4 text-[16px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-[14px] text-sc-muted">{label}</dt>
      <dd className="m-0 text-[15px] font-semibold tabular-nums [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

type PeriodRow = MembershipPeriod & { packageName: string };

function HistoryList({ memberships }: { memberships: MemberMembership[] }) {
  if (!memberships.length) return <EmptyState title="Chưa có lịch sử gói" />;
  return (
    <ul className="m-0 list-none p-0">
      {memberships.map((membership) => (
        <li
          key={membership.id}
          className="flex items-center justify-between gap-4 border-b border-sc-border-soft py-3 first:pt-0 last:border-b-0 last:pb-0"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-semibold">{membership.package.name}</span>
            <span className="text-[14px] text-sc-muted tabular-nums">
              {formatDate(membership.startDate)} – {formatDate(membership.endDate)}
            </span>
          </div>
          <StatusTag status={statusOf(membership)} />
        </li>
      ))}
    </ul>
  );
}

function PeriodList({ periods, activeId }: { periods: PeriodRow[]; activeId?: string }) {
  if (!periods.length) return <EmptyState title="Chưa có kỳ đã mua" />;
  return (
    <Collapse
      ghost
      expandIconPlacement="end"
      className="[&_.ant-collapse-content-box]:!px-0 [&_.ant-collapse-content-box]:!pt-0 [&_.ant-collapse-content-box]:!pb-3 [&_.ant-collapse-header]:!items-center [&_.ant-collapse-header]:!px-0 [&_.ant-collapse-header]:!py-3 [&_.ant-collapse-item]:border-b [&_.ant-collapse-item]:border-sc-border-soft [&_.ant-collapse-item:first-child_.ant-collapse-header]:!pt-0 [&_.ant-collapse-item:last-child]:border-b-0 [&_.ant-collapse-item:last-child:not(.ant-collapse-item-active)_.ant-collapse-header]:!pb-0"
      items={periods.map((period) => ({
        key: period.orderItemId,
        label: (
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-semibold">{period.packageName}</span>
                {period.orderItemId === activeId && (
                  <span className="rounded-md bg-sc-primary-soft px-1.5 py-px text-[12px] font-semibold text-sc-primary">
                    Đang dùng
                  </span>
                )}
              </span>
              <span className="text-[14px] text-sc-muted tabular-nums">
                {formatDate(period.periodStart)} – {formatDate(period.periodEnd)}
              </span>
            </div>
            <span className="shrink-0 font-semibold tabular-nums">{formatVND(period.paidAmount)}</span>
          </div>
        ),
        children: (
          <div className="rounded-xl bg-sc-paper px-4 py-3.5">
            <MembershipBenefits benefits={period.benefits} />
          </div>
        ),
      }))}
    />
  );
}

export function MyMembershipsPage() {
  const { query, cancel, terminate } = useMyMemberships();
  const [ending, setEnding] = useState(false);
  const current = query.data?.current;
  const today = dayjs().tz(VN_TIMEZONE).format('YYYY-MM-DD');
  const isEffective = Boolean(
    current && current.status === 'ACTIVE' && current.startDate <= today && today < current.endDate,
  );
  const displayStatus =
    current && (current.status === 'ACTIVE' && today >= current.endDate ? 'EXPIRED' : statusOf(current));
  const daysLeft = current ? Math.max(0, dayjs(current.endDate).diff(dayjs(today), 'day')) : 0;
  const totalDays = current ? Math.max(1, dayjs(current.endDate).diff(dayjs(current.startDate), 'day')) : 1;
  const leftPct = Math.min(100, Math.round((daysLeft / totalDays) * 100));
  const latestPeriod = current?.periods.reduce<MembershipPeriod | null>(
    (latest, period) => (!latest || period.periodStart > latest.periodStart ? period : latest),
    null,
  );
  const activePeriod = isEffective
    ? current?.periods.find(({ periodStart, periodEnd }) => periodStart <= today && today < periodEnd)
    : undefined;
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
  const renewLine = !current
    ? null
    : current.cancelledAt
      ? `Đã hủy, không tự gia hạn · quyền lợi dùng đến hết ${formatDate(current.endDate)}`
      : displayStatus === 'EXPIRED'
        ? `Đã hết hạn ngày ${formatDate(current.endDate)}`
        : `Tự gia hạn bằng ví vào ${formatDate(current.endDate)}`;

  return (
    <>
      <PageHeader
        title="Gói của tôi"
        extra={
          !current && (
            <Link to={PATHS.memberships}>
              <Button type="primary">Đăng ký gói</Button>
            </Link>
          )
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
          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            {current ? (
              <section className="flex flex-col overflow-hidden rounded-2xl border border-sc-border bg-sc-surface">
                <div className="flex flex-col gap-5 p-5 md:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-[14px] text-sc-muted">Gói hiện tại</span>
                        {displayStatus && <StatusTag status={displayStatus} />}
                      </div>
                      <h2 className="m-0 font-display text-[32px] leading-[1.05] font-extrabold [overflow-wrap:anywhere] text-sc-primary uppercase md:text-[38px]">
                        {current.package.name}
                      </h2>
                      {renewLine && <p className="m-0 text-[15px] text-sc-ink-2">{renewLine}</p>}
                    </div>
                    <div className="flex w-full gap-2 sm:w-auto">
                      <Link to={PATHS.memberships} className="flex-1 sm:flex-none">
                        <Button type="primary" block>
                          Gia hạn
                        </Button>
                      </Link>
                      <Link to={PATHS.memberships} className="flex-1 sm:flex-none">
                        <Button block>Đổi gói</Button>
                      </Link>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between gap-3 text-[14px]">
                      <span className="font-semibold">Còn {daysLeft} ngày</span>
                      <span className="text-sc-muted tabular-nums">{totalDays} ngày</span>
                    </div>
                    <div
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-sc-paper-2"
                      role="progressbar"
                      aria-valuenow={leftPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Thời gian còn lại của gói"
                    >
                      <div className="h-full rounded-full bg-sc-primary" style={{ width: `${leftPct}%` }} />
                    </div>
                  </div>
                </div>
                <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-sc-border-soft px-5 py-4 sm:grid-cols-[1fr_1.5fr_1fr] md:px-6">
                  {latestPeriod && <Fact label="Đã trả kỳ gần nhất">{formatVND(latestPeriod.paidAmount)}</Fact>}
                  <Fact label="Thời hạn">
                    {formatDate(current.startDate)} – {formatDate(current.endDate)}
                  </Fact>
                  {benefits && (
                    <Fact label="Ưu đãi thuê sân">
                      {benefits.bookingDiscountPct > 0 ? `Giảm ${benefits.bookingDiscountPct}% mọi sân` : 'Không có'}
                    </Fact>
                  )}
                </dl>
                <div className="flex-1 border-t border-sc-border-soft px-5 py-5 md:px-6">
                  <h3 className="m-0 mb-4 text-[16px] font-semibold">Quyền lợi</h3>
                  {benefits ? (
                    <MembershipBenefits benefits={benefits} className="sm:grid-cols-2" />
                  ) : (
                    <p className="m-0 text-[15px] text-sc-muted">Không có quyền lợi đang hiệu lực.</p>
                  )}
                  {benefits && totalSlots > 0 && (
                    <div className="mt-4 flex flex-wrap justify-between gap-2 rounded-lg bg-sc-paper px-3.5 py-2.5 text-[14px]">
                      <span className="text-sc-ink-2">Slot sân miễn phí tháng này · đã dùng {usedSlots}</span>
                      <strong className="tabular-nums">
                        {slotsLeft}/{totalSlots} còn lại
                      </strong>
                    </div>
                  )}
                </div>
                {isEffective && (
                  <div className="flex items-center justify-between gap-4 border-t border-sc-border-soft bg-sc-paper/50 px-5 py-4 md:px-6">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[15px] font-semibold">
                        {current.cancelledAt ? 'Chấm dứt gói' : 'Hủy gói thành viên'}
                      </span>
                      <span className="text-[14px] text-sc-muted">
                        {current.cancelledAt
                          ? 'Không dùng nữa? Bạn có thể kết thúc gói ngay hôm nay.'
                          : 'Dừng gia hạn hoặc chấm dứt ngay, không hoàn tiền.'}
                      </span>
                    </div>
                    <Button danger className="shrink-0" onClick={() => setEnding(true)}>
                      {current.cancelledAt ? 'Chấm dứt' : 'Hủy gói'}
                    </Button>
                    {ending && (
                      <EndMembershipModal
                        membership={current}
                        daysLeft={daysLeft}
                        today={today}
                        actions={{ cancel, terminate }}
                        onClose={() => setEnding(false)}
                      />
                    )}
                  </div>
                )}
              </section>
            ) : (
              <section className="rounded-2xl border border-sc-border bg-sc-surface p-6">
                <EmptyState
                  title="Bạn chưa có gói đang hiệu lực"
                  description="Bạn vẫn đặt sân và đăng ký lớp được với giá thông thường."
                  action={
                    <Link to={PATHS.memberships}>
                      <Button type="primary">Xem danh sách gói</Button>
                    </Link>
                  }
                />
              </section>
            )}
            <div className="flex flex-col gap-5">
              <Panel title="Lịch sử gói">
                <HistoryList memberships={allMemberships} />
              </Panel>
              <Panel title="Các kỳ đã mua" className="flex-1">
                <PeriodList periods={periods} activeId={activePeriod?.orderItemId} />
              </Panel>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
