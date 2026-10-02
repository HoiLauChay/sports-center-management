import type { Account } from '@sports-center/shared';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Table, Tabs, type TableColumnsType } from 'antd';
import { EmptyState } from '~/components/feedback/States';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { RecurringPackagePicker } from '~/features/bookings/components/RecurringPackagePicker';
import { SlotBookingPicker } from '~/features/bookings/components/SlotBookingPicker';
import type { Buyer, CheckoutItemInput } from '~/features/checkout/types';
import { useClasses } from '~/features/classes/hooks/useClasses';
import type { GymClass } from '~/features/classes/types';
import { weeklyText } from '~/features/classes/utils';
import { membershipsQueryOptions } from '~/features/memberships/hooks/useMemberships';
import { formatDate, formatVND } from '~/lib/format';

interface PickerProps {
  onAdd: (selection: CheckoutItemInput) => void;
}

function ClassPicker({ onAdd }: PickerProps) {
  const classes = useClasses({ page: 1, limit: 50 });
  const columns: TableColumnsType<GymClass> = [
    {
      title: 'Lớp',
      key: 'name',
      render: (_, item) => (
        <div className="flex min-w-44 flex-col">
          <b>{item.name}</b>
          <span className="text-[13px] text-sc-muted">HLV {item.coach?.fullName ?? '—'}</span>
        </div>
      ),
    },
    {
      title: 'Lịch',
      key: 'schedule',
      render: (_, item) => <span className="whitespace-nowrap">{weeklyText(item.weeklySchedule)}</span>,
    },
    {
      title: 'Khai giảng',
      dataIndex: 'startDate',
      render: (value: string | null) => (value ? formatDate(value) : '—'),
    },
    { title: 'Sĩ số', key: 'seats', render: (_, item) => `${item.enrolledCount}/${item.maxStudents}` },
    {
      title: 'Học phí',
      key: 'price',
      align: 'right',
      render: (_, item) => <b className="whitespace-nowrap tabular-nums">{formatVND(item.course.price)}</b>,
    },
    {
      title: '',
      key: 'add',
      align: 'right',
      render: (_, item) => (
        <Button size="small" type="primary" onClick={() => onAdd({ type: 'COURSE_ENROLLMENT', classId: item.id })}>
          Thêm vào đơn
        </Button>
      ),
    },
  ];
  return (
    <Table<GymClass>
      rowKey="id"
      size="small"
      columns={columns}
      dataSource={classes.data?.items}
      loading={classes.isFetching}
      pagination={false}
      scroll={{ x: 'max-content' }}
      locale={{ emptyText: classes.isFetching ? ' ' : <EmptyState title="Chưa có lớp nào đang nhận đăng ký" /> }}
    />
  );
}

function MembershipPicker({ onAdd }: PickerProps) {
  const packages = useQuery(membershipsQueryOptions);
  const plans = (packages.data ?? []).filter((plan) => plan.isActive);
  return (
    <Table
      rowKey="id"
      size="small"
      loading={packages.isFetching}
      dataSource={plans}
      pagination={false}
      scroll={{ x: 'max-content' }}
      locale={{ emptyText: packages.isFetching ? ' ' : <EmptyState title="Chưa có gói đang bán" /> }}
      columns={[
        {
          title: 'Gói',
          key: 'name',
          render: (_, plan) => (
            <div className="flex min-w-40 flex-col">
              <b>{plan.name}</b>
              <span className="text-[13px] text-sc-muted">{plan.durationDays} ngày</span>
            </div>
          ),
        },
        {
          title: 'Quyền lợi',
          key: 'benefits',
          render: (_, plan) => (
            <span className="text-[13px]">
              {plan.gymAccess ? 'Gym miễn phí · ' : ''}−{plan.bookingDiscountPct}% sân · −{plan.classDiscountPct}% lớp ·{' '}
              {plan.freeBookingSlotsPerMonth} slot free/tháng
            </span>
          ),
        },
        {
          title: 'Giá',
          key: 'price',
          align: 'right' as const,
          render: (_, plan) => <b className="whitespace-nowrap tabular-nums">{formatVND(plan.price)}</b>,
        },
        {
          title: '',
          key: 'add',
          align: 'right' as const,
          render: (_, plan) => (
            <Button size="small" type="primary" onClick={() => onAdd({ type: 'MEMBERSHIP', packageId: plan.id })}>
              Thêm vào đơn
            </Button>
          ),
        },
      ]}
    />
  );
}

interface CounterServicePickerProps {
  user: Account;
  buyer: Buyer;
  isMember: boolean;
  onAdd: (selection: CheckoutItemInput) => void;
}

/** Step 2: reuse the slot grid, recurring package, class list and membership list to add lines to the counter draft. */
export function CounterServicePicker({ user, buyer, isMember, onAdd }: CounterServicePickerProps) {
  return (
    <Card>
      <SectionTitle>2. Thêm dịch vụ</SectionTitle>
      <Tabs
        items={[
          {
            key: 'slot',
            label: 'Đặt sân / phòng',
            children: <SlotBookingPicker user={user} buyer={buyer} onAdd={onAdd} />,
          },
          ...(isMember
            ? [
                {
                  key: 'package',
                  label: 'Gói sân định kỳ',
                  children: <RecurringPackagePicker user={user} buyer={buyer} onAdd={onAdd} />,
                },
                { key: 'class', label: 'Đăng ký lớp', children: <ClassPicker onAdd={onAdd} /> },
                { key: 'membership', label: 'Gói thành viên', children: <MembershipPicker onAdd={onAdd} /> },
              ]
            : []),
        ]}
      />
    </Card>
  );
}
