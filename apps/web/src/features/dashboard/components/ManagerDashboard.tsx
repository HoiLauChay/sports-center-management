import type { SessionDetail } from '@sports-center/shared';
import { Link } from '@tanstack/react-router';
import { Card, Progress, Table, Tag, type TableColumnsType } from 'antd';
import { Banknote, CalendarCheck, GraduationCap, TriangleAlert, UserPlus } from 'lucide-react';
import { useMemo } from 'react';
import { BarChart, type ChartDatum } from '~/components/charts/BarChart';
import { PageHeader } from '~/components/ui/PageHeader';
import { StatCard } from '~/components/ui/StatCard';
import { useClassOverview } from '~/features/classes';
import type { GymClass } from '~/features/classes/types';
import { classStatusTag } from '~/features/classes/utils';
import { useOverviewReport, useRevenueReport } from '~/features/reports/hooks/useReports';
import { periodLabel, REVENUE_SERIES } from '~/features/reports/utils';
import { useSessionsOn } from '~/features/schedule';
import { useCheckInsToday } from '~/features/training/hooks/useTraining';
import { formatVND } from '~/lib/format';
import { DATE_FORMAT, formatDayLabel, nowVN, todayVN } from '~/lib/time';

const MONTHS = 6;

const sessionColumns: TableColumnsType<SessionDetail> = [
  {
    title: 'Giờ',
    key: 'time',
    width: 130,
    render: (_, session) => <b className="whitespace-nowrap">{session.startTime}</b>,
  },
  {
    title: 'Lớp',
    key: 'class',
    render: (_, session) => (
      <div className="flex flex-col">
        <Link to="/admin/classes/$classId" params={{ classId: session.class.id }} className="font-semibold">
          {session.class.name}
        </Link>
        <span className="text-[12px] text-sc-muted">
          {session.facility.name} · HLV {session.class.coach?.fullName ?? '—'} · {session.class.enrolledCount}/
          {session.class.maxStudents} HV
        </span>
      </div>
    ),
  },
];

/** How well a running class is filling up: the manager's cue to push enrollments or step in. */
function fillState(item: GymClass) {
  const rate = item.enrolledCount / item.maxStudents;
  if (item.enrolledCount < item.minStudents) return { label: 'Thiếu sĩ số', color: 'warning', bar: '#f59e0b' };
  return rate >= 0.8
    ? { label: 'Tốt', color: 'success', bar: '#0f4d34' }
    : { label: 'Ổn định', color: 'processing', bar: '#0f4d34' };
}

const classColumns: TableColumnsType<GymClass> = [
  {
    title: 'Lớp',
    key: 'class',
    render: (_, item) => {
      const tag = classStatusTag(item);
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/admin/classes/$classId" params={{ classId: item.id }} className="font-semibold">
            {item.name}
          </Link>
          <Tag color={tag.color}>{tag.label}</Tag>
        </div>
      );
    },
  },
  { title: 'Huấn luyện viên', dataIndex: ['coach', 'fullName'], render: (name?: string) => name ?? '—' },
  {
    title: 'Đã đăng ký',
    key: 'enrolled',
    render: (_, item) => (
      <span className="whitespace-nowrap">
        {item.enrolledCount} / {item.maxStudents}{' '}
        <span className={item.enrolledCount < item.minStudents ? 'text-sc-accent' : 'text-sc-muted-2'}>
          (min {item.minStudents})
        </span>
      </span>
    ),
  },
  {
    title: 'Tỷ lệ lấp đầy',
    key: 'fill',
    width: 240,
    render: (_, item) => (
      <Progress
        percent={Math.round((item.enrolledCount / item.maxStudents) * 100)}
        size="small"
        strokeColor={fillState(item).bar}
      />
    ),
  },
  {
    title: 'Đánh giá',
    key: 'state',
    render: (_, item) => {
      const state = fillState(item);
      return <Tag color={state.color}>{state.label}</Tag>;
    },
  },
];

/** Manager home: today's figures, what needs a decision, revenue by service, today's sessions and class fill rates. */
export function ManagerDashboard() {
  const today = todayVN();
  const overview = useOverviewReport();
  const checkIns = useCheckInsToday();
  const sessions = useSessionsOn(today);
  const classes = useClassOverview();
  const revenue = useRevenueReport({
    from: nowVN()
      .subtract(MONTHS - 1, 'month')
      .startOf('month')
      .format(DATE_FORMAT),
    to: today,
    granularity: 'month',
  });

  const data = overview.data;
  const pending = classes.data?.pendingApproval ?? [];
  const unmatched = data?.unmatchedBankTransactions ?? 0;
  const chart: ChartDatum[] = useMemo(
    () =>
      (revenue.data?.buckets ?? []).map((bucket) => ({
        label: periodLabel(bucket.period, 'month'),
        values: { ...bucket.byType },
      })),
    [revenue.data],
  );

  return (
    <>
      <PageHeader
        title="Tổng quan trung tâm"
        description={`${formatDayLabel(today)} · ${checkIns.data?.length ?? 0} lượt check-in hôm nay`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Banknote}
          label="Doanh thu hôm nay"
          loading={overview.isPending}
          value={formatVND(data?.revenueToday ?? 0)}
          hint="Không gồm nạp ví, đã trừ hoàn tiền"
        />
        <StatCard
          icon={UserPlus}
          label="Thành viên mới"
          loading={overview.isPending}
          value={data?.newMembersToday ?? 0}
          hint={`${data?.activeMemberships ?? 0} gói đang hiệu lực`}
        />
        <StatCard
          icon={CalendarCheck}
          label="Booking hôm nay"
          loading={overview.isPending}
          value={data?.bookingsToday ?? 0}
        />
        <StatCard
          icon={GraduationCap}
          label="Lớp đang diễn ra"
          loading={overview.isPending}
          value={data?.ongoingClasses ?? 0}
          hint={`${sessions.data?.length ?? 0} buổi hôm nay`}
        />
      </div>

      {(pending.length > 0 || unmatched > 0) && (
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-solid border-[#ffe58f] bg-[#fffbe6] px-4 py-2.5 text-[13.5px]">
          <TriangleAlert size={15} className="text-[#d48806]" />
          <b>Cần Manager xử lý:</b>
          {pending.length > 0 && (
            <Link to="/admin/classes/$classId" params={{ classId: pending[0]!.id }} className="font-medium">
              {pending.length} lớp chờ duyệt mở
            </Link>
          )}
          {pending.length > 0 && unmatched > 0 && <span>·</span>}
          {unmatched > 0 && (
            <Link to="/admin/bank-transactions" className="font-medium">
              {unmatched} giao dịch ngân hàng chưa khớp
            </Link>
          )}
        </div>
      )}

      <Card
        title={`Doanh thu ${MONTHS} tháng theo loại dịch vụ`}
        className="!mt-4"
        loading={revenue.isPending}
        styles={{ header: { minHeight: 52 } }}
        extra={
          <Link to="/admin/reports" className="text-[13px] font-medium">
            Báo cáo chi tiết
          </Link>
        }
      >
        <BarChart data={chart} series={REVENUE_SERIES} mode="stacked" ariaLabel="Doanh thu theo tháng" />
      </Card>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <Card title="Buổi học hôm nay" styles={{ header: { minHeight: 52 }, body: { padding: 0 } }}>
          <Table<SessionDetail>
            rowKey="id"
            size="middle"
            showHeader={false}
            columns={sessionColumns}
            dataSource={sessions.data}
            loading={sessions.isPending}
            pagination={false}
            locale={{ emptyText: 'Hôm nay chưa có buổi học nào' }}
          />
        </Card>
        <Card title="Lớp chờ duyệt mở" styles={{ header: { minHeight: 52 }, body: { padding: 0 } }}>
          <Table<GymClass>
            rowKey="id"
            size="middle"
            showHeader={false}
            dataSource={pending}
            loading={classes.isPending}
            pagination={false}
            locale={{ emptyText: 'Không có lớp nào chờ duyệt' }}
            columns={[
              {
                key: 'class',
                render: (_, item) => (
                  <div className="flex flex-col">
                    <Link to="/admin/classes/$classId" params={{ classId: item.id }} className="font-semibold">
                      {item.name}
                    </Link>
                    <span className="text-[12px] text-sc-muted">
                      {item.coach ? `HLV ${item.coach.fullName}` : 'Chưa có HLV'} · {item.enrolledCount}/
                      {item.maxStudents} HV
                    </span>
                  </div>
                ),
              },
              {
                key: 'status',
                align: 'right',
                render: (_, item) =>
                  item.coach ? <Tag color="warning">Chờ duyệt</Tag> : <Tag color="error">Thiếu HLV</Tag>,
              },
            ]}
          />
        </Card>
      </div>

      <Card
        title="Tình trạng đăng ký lớp (OPEN / ONGOING)"
        className="!mt-4"
        styles={{ header: { minHeight: 52 }, body: { padding: 0 } }}
      >
        <Table<GymClass>
          rowKey="id"
          size="middle"
          columns={classColumns}
          dataSource={classes.data?.running}
          loading={classes.isPending}
          pagination={{ pageSize: 8, hideOnSinglePage: true }}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'Chưa có lớp nào đang mở' }}
        />
      </Card>
    </>
  );
}
