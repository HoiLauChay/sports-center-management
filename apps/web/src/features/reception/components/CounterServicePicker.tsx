import type { Account } from '@sports-center/shared';
import { useQuery } from '@tanstack/react-query';
import { Button, Progress, Skeleton, Tabs, Tag } from 'antd';
import { CalendarRange, Check, CircleCheck, Crown, Dumbbell, LandPlot, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '~/components/feedback/States';
import { RecurringPackagePicker } from '~/features/bookings/components/RecurringPackagePicker';
import { SlotBookingPicker } from '~/features/bookings/components/SlotBookingPicker';
import type { CheckoutBuyer, CheckoutItemInput } from '~/features/checkout/types';
import { selectionKey } from '~/features/checkout/utils';
import { useClasses } from '~/features/classes/hooks/useClasses';
import { weeklyText } from '~/features/classes/utils';
import { membershipsQueryOptions } from '~/features/memberships/hooks/useMemberships';
import { formatDate, formatVND } from '~/lib/format';
import { benefitsText } from '../utils';

export type CounterServiceTab = 'slot' | 'package' | 'class' | 'membership';

interface PickerProps {
  onAdd: (selection: CheckoutItemInput) => void;
  /** Selection keys already in the draft, so the same service is not added twice. */
  inCart: Set<string>;
}

function AddButton({ added, full, onClick }: { added: boolean; full?: boolean; onClick: () => void }) {
  if (added) {
    return (
      <Button block disabled icon={<Check size={15} />}>
        Đã thêm
      </Button>
    );
  }
  return (
    <Button block type="primary" disabled={full} icon={<Plus size={15} />} onClick={onClick}>
      {full ? 'Hết chỗ' : 'Thêm vào đơn'}
    </Button>
  );
}

function CardGrid({ loading, empty, children }: { loading: boolean; empty: string; children: ReactNode[] }) {
  if (loading && !children.length) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="rounded-xl border border-sc-border-soft p-4">
            <Skeleton active paragraph={{ rows: 3 }} />
          </div>
        ))}
      </div>
    );
  }
  if (!children.length) return <EmptyState title={empty} />;
  return <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">{children}</div>;
}

function ClassPicker({ onAdd, inCart }: PickerProps) {
  const classes = useClasses({ page: 1, limit: 50 });
  const items = classes.data?.items ?? [];
  return (
    <CardGrid loading={classes.isFetching} empty="Chưa có lớp nào đang nhận đăng ký">
      {items.map((item) => {
        const selection: CheckoutItemInput = { type: 'COURSE_ENROLLMENT', classId: item.id };
        const full = item.enrolledCount >= item.maxStudents;
        const fill = item.maxStudents ? Math.round((item.enrolledCount / item.maxStudents) * 100) : 0;
        return (
          <article
            key={item.id}
            className="flex flex-col gap-3 rounded-xl border border-sc-border-soft bg-white p-4 transition-shadow hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col">
                <b className="text-[15px] leading-snug text-sc-ink">{item.name}</b>
                <span className="text-[13px] text-sc-muted">
                  {item.course.sport.name} · HLV {item.coach?.fullName ?? '—'}
                </span>
              </div>
              <b className="shrink-0 font-display text-[18px] tabular-nums text-sc-ink">
                {formatVND(item.course.price)}
              </b>
            </div>
            <div className="flex flex-col gap-1 text-[13px] text-sc-ink-2">
              <span>{weeklyText(item.weeklySchedule) || 'Chưa có lịch'}</span>
              <span className="text-sc-muted">
                {item.startDate ? `Khai giảng ${formatDate(item.startDate)}` : 'Chưa có ngày khai giảng'} ·{' '}
                {item.course.totalSessions} buổi
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Progress
                percent={fill}
                showInfo={false}
                size="small"
                strokeColor={full ? 'var(--sc-error)' : fill >= 80 ? 'var(--sc-warning)' : 'var(--sc-primary)'}
                className="!m-0 flex-1"
              />
              <span className={`text-xs tabular-nums ${full ? 'font-semibold text-sc-error' : 'text-sc-muted'}`}>
                {item.enrolledCount}/{item.maxStudents} chỗ
              </span>
            </div>
            <div className="mt-auto">
              <AddButton added={inCart.has(selectionKey(selection))} full={full} onClick={() => onAdd(selection)} />
            </div>
          </article>
        );
      })}
    </CardGrid>
  );
}

function MembershipPicker({ onAdd, inCart, currentPackageId }: PickerProps & { currentPackageId?: string }) {
  const packages = useQuery(membershipsQueryOptions);
  const plans = (packages.data ?? []).filter((plan) => plan.isActive).sort((a, b) => a.price - b.price);
  return (
    <CardGrid loading={packages.isFetching} empty="Chưa có gói đang bán">
      {plans.map((plan) => {
        const selection: CheckoutItemInput = { type: 'MEMBERSHIP', packageId: plan.id };
        const current = plan.id === currentPackageId;
        return (
          <article
            key={plan.id}
            className={`flex flex-col gap-3 rounded-xl border bg-white p-4 transition-shadow hover:shadow-sm ${
              current
                ? 'border-sc-primary-border shadow-[inset_0_0_0_1px_var(--sc-primary-border)]'
                : 'border-sc-border-soft'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col">
                <span className="flex flex-wrap items-center gap-2">
                  <b className="text-[15px] text-sc-ink">{plan.name}</b>
                  {current && (
                    <Tag color="green" className="!m-0">
                      Đang dùng
                    </Tag>
                  )}
                </span>
                <span className="text-[13px] text-sc-muted">{plan.durationDays} ngày</span>
              </div>
              <b className="shrink-0 font-display text-[18px] tabular-nums text-sc-ink">{formatVND(plan.price)}</b>
            </div>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] text-sc-ink-2">
              {(benefitsText(plan) || 'Không có ưu đãi').split(' · ').map((benefit) => (
                <li key={benefit} className="flex items-center gap-1.5">
                  <CircleCheck size={14} className="shrink-0 text-sc-success" />
                  {benefit}
                </li>
              ))}
            </ul>
            <div className="mt-auto">
              <AddButton added={inCart.has(selectionKey(selection))} onClick={() => onAdd(selection)} />
            </div>
          </article>
        );
      })}
    </CardGrid>
  );
}

function TabLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {children}
    </span>
  );
}

interface CounterServicePickerProps {
  user: Account;
  buyer: CheckoutBuyer;
  isMember: boolean;
  tab: CounterServiceTab;
  onTab: (tab: CounterServiceTab) => void;
  inCart: Set<string>;
  currentPackageId?: string;
  onAdd: (selection: CheckoutItemInput) => void;
}

/** The catalogue of the counter: slot grid, recurring package, classes and memberships. Guests only book slots. */
export function CounterServicePicker({
  user,
  buyer,
  isMember,
  tab,
  onTab,
  inCart,
  currentPackageId,
  onAdd,
}: CounterServicePickerProps) {
  return (
    <section className="rounded-xl border border-sc-border bg-white px-4 pt-1 pb-4 shadow-xs">
      <Tabs
        activeKey={isMember ? tab : 'slot'}
        onChange={(key) => onTab(key as CounterServiceTab)}
        items={[
          {
            key: 'slot',
            label: <TabLabel icon={<LandPlot size={16} />}>Đặt sân / phòng</TabLabel>,
            children: <SlotBookingPicker user={user} buyer={buyer} onAdd={onAdd} />,
          },
          ...(isMember
            ? [
                {
                  key: 'package',
                  label: <TabLabel icon={<CalendarRange size={16} />}>Gói sân định kỳ</TabLabel>,
                  children: <RecurringPackagePicker user={user} buyer={buyer} onAdd={onAdd} />,
                },
                {
                  key: 'class',
                  label: <TabLabel icon={<Dumbbell size={16} />}>Đăng ký lớp</TabLabel>,
                  children: <ClassPicker onAdd={onAdd} inCart={inCart} />,
                },
                {
                  key: 'membership',
                  label: <TabLabel icon={<Crown size={16} />}>Gói thành viên</TabLabel>,
                  children: <MembershipPicker onAdd={onAdd} inCart={inCart} currentPackageId={currentPackageId} />,
                },
              ]
            : []),
        ]}
      />
    </section>
  );
}
