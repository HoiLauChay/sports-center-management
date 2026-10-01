import type { MembershipPackage } from '@sports-center/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Alert, Button, Card, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { EmptyState, ErrorState, PageLoading } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { PATHS } from '~/constants/paths';
import { formatVND, VN_TIMEZONE } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { membershipsQueryOptions } from '../hooks/useMemberships';
import { useMyMemberships } from '../hooks/useMyMemberships';

interface BenefitRow {
  label: string;
  highlight: boolean;
}

function benefitRows(plan: MembershipPackage): BenefitRow[] {
  return [
    {
      label: plan.gymAccess ? 'Vào gym miễn phí (đặt slot, không trừ tiền)' : 'Không bao gồm gym',
      highlight: plan.gymAccess,
    },
    { label: `Giảm ${plan.bookingDiscountPct}% đặt sân / phòng`, highlight: plan.bookingDiscountPct > 0 },
    { label: `Giảm ${plan.classDiscountPct}% học phí lớp`, highlight: plan.classDiscountPct > 0 },
    {
      label: plan.freeBookingSlotsPerMonth
        ? `${plan.freeBookingSlotsPerMonth} slot sân miễn phí mỗi tháng`
        : 'Không có slot miễn phí',
      highlight: false,
    },
  ];
}

function periodLabel(plan: MembershipPackage) {
  const months = Math.round(plan.durationDays / 30);
  if (months < 2) return `${plan.durationDays} ngày`;
  const perMonth = Math.round((plan.price / plan.durationDays) * 30);
  return `${months >= 12 ? '12 tháng' : `${months} tháng`} · ${formatVND(perMonth)}/tháng`;
}

interface PlanCardProps {
  plan: MembershipPackage;
  current: boolean;
  locked: boolean;
  daysLeft: number;
}

function PlanCard({ plan, current, locked, daysLeft }: PlanCardProps) {
  const buttonLabel = current ? 'Gia hạn gói này' : locked ? 'Không đổi khi còn gói' : 'Đăng ký gói này';
  const tooltip = locked
    ? 'Đang có gói khác còn hiệu lực. Đổi gói sau khi hết hạn hoặc hủy gói.'
    : 'Đăng ký gói trực tuyến sắp được mở. Liên hệ quầy lễ tân để được hỗ trợ.';

  return (
    <div
      className={`flex min-w-0 flex-col rounded-xl bg-white px-6 pt-[22px] pb-6 shadow-[0_1px_2px_rgba(20,19,15,.03),0_2px_10px_rgba(20,19,15,.04)] ${
        current ? 'border-2 border-sc-primary !px-[23px] !pt-[21px] !pb-[23px]' : 'border border-sc-border-soft'
      } ${locked ? 'opacity-60' : ''}`}
    >
      <div
        className={`mb-3.5 min-h-4 font-display text-xs font-bold tracking-[.12em] uppercase ${
          current ? 'text-sc-primary' : 'text-sc-accent'
        }`}
      >
        {current ? `Gói của bạn · còn ${daysLeft} ngày` : ' '}
      </div>
      <h2 className="m-0 font-display text-[28px] leading-none font-extrabold tracking-[.005em] uppercase [overflow-wrap:anywhere]">
        {plan.name}
      </h2>
      <p className="mt-1.5 mb-0 min-h-10 text-[13px] text-sc-muted [overflow-wrap:anywhere]">
        {plan.description ?? 'Gói thành viên dành cho việc tập luyện tại trung tâm.'}
      </p>
      <div className="mt-[18px] font-display text-[40px] leading-none font-extrabold tracking-[-.01em] tabular-nums [overflow-wrap:anywhere]">
        {formatVND(plan.price)}
      </div>
      <div className="mt-1.5 text-[13px] text-sc-muted tabular-nums">{periodLabel(plan)}</div>
      <ul className="mt-[18px] mb-[22px] flex-1 list-none border-t border-sc-border-soft p-0">
        {benefitRows(plan).map(({ label, highlight }) => (
          <li
            key={label}
            className={`border-b border-sc-border-soft py-[9px] text-sm leading-[1.35] ${
              highlight ? 'font-semibold text-sc-primary' : ''
            }`}
          >
            {label}
          </li>
        ))}
      </ul>
      <Tooltip title={tooltip}>
        <span className="block">
          <Button
            block
            disabled
            type={current ? 'primary' : 'default'}
            className="!h-[46px] !font-display !text-[17px] !font-extrabold !tracking-[.04em] !uppercase"
          >
            {buttonLabel}
          </Button>
        </span>
      </Tooltip>
    </div>
  );
}

export function MembershipPlansPage() {
  const packages = useQuery(membershipsQueryOptions);
  const mine = useMyMemberships().query.data?.current;
  const plans = packages.data?.filter((membership) => membership.isActive);
  const today = dayjs().tz(VN_TIMEZONE).format('YYYY-MM-DD');
  const ownedPlan = mine && mine.status === 'ACTIVE' && today < mine.endDate ? mine : null;
  const daysLeft = ownedPlan ? Math.max(0, dayjs(ownedPlan.endDate).diff(dayjs(today), 'day')) : 0;

  return (
    <>
      <PageHeader
        title="Gói thành viên"
        description="Không cần gói vẫn đặt sân và đăng ký lớp. Gói thêm quyền lợi: vào gym, giảm giá đặt sân & học phí, slot sân miễn phí."
      />
      {packages.isPending ? (
        <PageLoading />
      ) : packages.error && !packages.data ? (
        <Card>
          <ErrorState message={toApiError(packages.error).message} onRetry={() => void packages.refetch()} />
        </Card>
      ) : (
        <>
          {packages.error && (
            <Alert
              type="error"
              showIcon
              title={toApiError(packages.error).message}
              action={
                <Button size="small" onClick={() => void packages.refetch()}>
                  Thử lại
                </Button>
              }
              className="!mb-4"
            />
          )}
          {plans?.length ? (
            <div className="grid grid-cols-1 items-stretch gap-4 min-[601px]:grid-cols-2 min-[1001px]:grid-cols-3 min-[1401px]:grid-cols-4">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  current={ownedPlan?.package.id === plan.id}
                  locked={Boolean(ownedPlan) && ownedPlan?.package.id !== plan.id}
                  daysLeft={daysLeft}
                />
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState title="Chưa có gói đang bán" description="Vui lòng quay lại sau hoặc liên hệ quầy lễ tân." />
            </Card>
          )}
          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-[13px] text-sc-muted">
            <span>
              Gia hạn nối tiếp từ ngày hết hạn; gói mua trong cùng đơn chưa giảm giá cho các dòng khác của đơn đó.
            </span>
            <span>
              Hủy gói: mất quyền lợi ngay, không hoàn tiền.{' '}
              <Link
                to={PATHS.myMemberships}
                className="font-semibold text-sc-ink underline decoration-sc-border underline-offset-[3px] hover:text-sc-primary"
              >
                Gói của tôi
              </Link>
            </span>
          </div>
        </>
      )}
    </>
  );
}
