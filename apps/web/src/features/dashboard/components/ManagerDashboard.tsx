import { Link } from '@tanstack/react-router';
import { Badge, Card, Progress, Spin, Table, Tag, type TableColumnsType } from 'antd';
import {
  ArrowRight,
  Banknote,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  MapPin,
  TriangleAlert,
  User,
  UserPlus,
} from 'lucide-react';
import { useMemo } from 'react';
import { BarChart, type ChartDatum } from '~/components/charts/BarChart';
import { PageHeader } from '~/components/ui/PageHeader';
import { StatCard } from '~/components/ui/StatCard';
import { useClassOverview } from '~/features/classes';
import type { GymClass } from '~/features/classes/types';
import { classStatusTag, weeklyText } from '~/features/classes/utils';
import { useOverviewReport, useRevenueReport } from '~/features/reports/hooks/useReports';
import { periodLabel, REVENUE_SERIES } from '~/features/reports/utils';
import { useSessionsOn } from '~/features/schedule';
import { useCheckInsToday } from '~/features/training/hooks/useTraining';
import { formatVND } from '~/lib/format';
import { DATE_FORMAT, formatDayLabel, nowVN, todayVN } from '~/lib/time';

const MONTHS = 6;

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
    minWidth: 280,
    render: (_, item) => {
      const tag = classStatusTag(item);
      return (
        <div className="flex flex-col gap-2 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/admin/classes/$classId"
              params={{ classId: item.id }}
              className="text-[14.5px] font-bold text-sc-ink hover:text-sc-primary hover:underline"
            >
              {item.name}
            </Link>
            <Tag color={tag.color} className="!m-0 px-2 py-0.5 text-xs font-medium">
              {tag.label}
            </Tag>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-sc-muted">
            <Tag color="cyan" className="!m-0 text-[11px] leading-tight px-1.5 py-0.5">
              {item.course.sport.name}
            </Tag>
            <span>·</span>
            <span>{item.facility.name}</span>
            {item.weeklySchedule?.length > 0 && (
              <>
                <span>·</span>
                <span>{weeklyText(item.weeklySchedule)}</span>
              </>
            )}
          </div>
        </div>
      );
    },
  },
  {
    title: 'Huấn luyện viên',
    dataIndex: ['coach', 'fullName'],
    width: 180,
    render: (name?: string) => <div className="py-3 font-medium text-sc-ink">{name ?? '—'}</div>,
  },
  {
    title: 'Đã đăng ký',
    key: 'enrolled',
    width: 180,
    render: (_, item) => (
      <div className="flex flex-col gap-1 py-3">
        <span className="text-[13.5px] font-bold text-sc-ink tabular-nums">
          {item.enrolledCount} / {item.maxStudents} HV
        </span>
        <span
          className={`text-xs ${item.enrolledCount < item.minStudents ? 'text-amber-600 font-medium' : 'text-sc-muted'}`}
        >
          (Tối thiểu: {item.minStudents} HV)
        </span>
      </div>
    ),
  },
  {
    title: 'Tỷ lệ lấp đầy',
    key: 'fill',
    width: 200,
    render: (_, item) => (
      <div className="py-3">
        <Progress
          percent={Math.round((item.enrolledCount / (item.maxStudents || 1)) * 100)}
          size="small"
          strokeColor={fillState(item).bar}
          className="!m-0"
        />
      </div>
    ),
  },
  {
    title: 'Đánh giá',
    key: 'state',
    width: 130,
    render: (_, item) => {
      const state = fillState(item);
      return (
        <div className="py-3">
          <Tag color={state.color} className="!m-0 px-2 py-0.5 font-medium text-xs">
            {state.label}
          </Tag>
        </div>
      );
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

      <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-2">
        <Card
          className="flex flex-col h-full overflow-hidden"
          title={
            <div className="flex items-center gap-2">
              <CalendarCheck size={18} className="text-emerald-700 shrink-0" />
              <span className="font-bold text-sc-ink">Buổi học hôm nay</span>
              {sessions.data && sessions.data.length > 0 && (
                <span className="text-xs font-normal text-sc-muted">({sessions.data.length} buổi)</span>
              )}
            </div>
          }
          styles={{
            header: { minHeight: 52, borderBottom: '1px solid #f1f5f9' },
            body: { padding: 0, flex: 1, display: 'flex', flexDirection: 'column' },
          }}
          extra={
            <Link
              to="/schedule"
              className="group inline-flex items-center gap-1 text-[13px] font-medium text-emerald-700 hover:text-emerald-800 transition-colors"
            >
              <span>Xem lịch trình</span>
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          }
        >
          {sessions.isPending ? (
            <div className="flex flex-1 items-center justify-center py-12">
              <Spin />
            </div>
          ) : !sessions.data || sessions.data.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <CalendarCheck size={24} />
              </div>
              <span className="text-sm font-semibold text-sc-ink">Hôm nay không có buổi học nào</span>
              <span className="mt-1 text-xs text-sc-muted max-w-xs">
                Không có lớp học nào được xếp lịch diễn ra trong ngày hôm nay.
              </span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-y-auto max-h-[380px]">
              {sessions.data.map((session) => (
                <div
                  key={session.id}
                  className="group flex items-center justify-between gap-3.5 p-3.5 sm:px-5 transition-colors hover:bg-slate-50/80"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex flex-col items-center justify-center shrink-0 w-[76px] py-1.5 px-1 rounded-lg bg-emerald-50/90 border border-emerald-200/80 text-center">
                      <span className="font-mono text-[13px] font-bold text-emerald-800 tracking-tight">
                        {session.startTime}
                      </span>
                      <span className="text-[11px] font-medium text-emerald-600/90">đến {session.endTime}</span>
                    </div>

                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to="/admin/classes/$classId"
                          params={{ classId: session.class.id }}
                          className="font-semibold text-sc-ink text-[14px] hover:text-emerald-700 hover:underline transition-colors line-clamp-1"
                        >
                          {session.class.name}
                        </Link>
                        {session.class.sport && (
                          <Tag color="cyan" className="!m-0 text-[11px] leading-tight px-1.5 py-0.5">
                            {session.class.sport.name}
                          </Tag>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-sc-muted flex-wrap">
                        <span className="flex items-center gap-1 text-slate-600">
                          <MapPin size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{session.facility.name}</span>
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <User size={12} className="text-slate-400 shrink-0" />
                          <span>
                            HLV:{' '}
                            <strong className="font-medium text-sc-ink">
                              {session.class.coach?.fullName ?? 'Chưa phân công'}
                            </strong>
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="hidden sm:flex flex-col items-end text-right">
                      <span className="text-xs font-bold text-sc-ink tabular-nums">
                        {session.class.enrolledCount} / {session.class.maxStudents} HV
                      </span>
                      <span className="text-[11px] text-sc-muted">Sĩ số</span>
                    </div>
                    <Link
                      to="/admin/classes/$classId"
                      params={{ classId: session.class.id }}
                      aria-label="Xem chi tiết lớp học"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                    >
                      <ChevronRight size={16} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          className="flex flex-col h-full overflow-hidden"
          title={
            <div className="flex items-center gap-2">
              <GraduationCap size={18} className="text-amber-600 shrink-0" />
              <span className="font-bold text-sc-ink">Lớp chờ duyệt mở</span>
              {pending.length > 0 && <Badge count={pending.length} className="!ms-0.5" />}
            </div>
          }
          styles={{
            header: { minHeight: 52, borderBottom: '1px solid #f1f5f9' },
            body: { padding: 0, flex: 1, display: 'flex', flexDirection: 'column' },
          }}
          extra={
            <Link
              to="/admin/classes"
              className="group inline-flex items-center gap-1 text-[13px] font-medium text-emerald-700 hover:text-emerald-800 transition-colors"
            >
              <span>Quản lý lớp</span>
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          }
        >
          {classes.isPending ? (
            <div className="flex flex-1 items-center justify-center py-12">
              <Spin />
            </div>
          ) : pending.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600">
                <CheckCircle2 size={24} />
              </div>
              <span className="text-sm font-semibold text-sc-ink">Không có lớp nào chờ duyệt</span>
              <span className="mt-1 text-xs text-sc-muted max-w-xs">
                Tất cả yêu cầu mở lớp đã được xử lý hoặc chưa có lớp học mới cần xét duyệt.
              </span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-y-auto max-h-[380px]">
              {pending.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center justify-between gap-3 p-3.5 sm:px-5 transition-colors hover:bg-slate-50/80"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-200/60">
                      <GraduationCap size={20} />
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to="/admin/classes/$classId"
                          params={{ classId: item.id }}
                          className="font-semibold text-sc-ink text-[14px] hover:text-emerald-700 hover:underline transition-colors line-clamp-1"
                        >
                          {item.name}
                        </Link>
                        {item.course?.sport && (
                          <Tag color="cyan" className="!m-0 text-[11px] leading-tight px-1.5 py-0.5">
                            {item.course.sport.name}
                          </Tag>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-sc-muted flex-wrap">
                        <span>
                          HLV:{' '}
                          <strong className={item.coach ? 'font-medium text-sc-ink' : 'font-medium text-amber-600'}>
                            {item.coach ? item.coach.fullName : 'Chưa phân công'}
                          </strong>
                        </span>
                        <span>·</span>
                        <span>
                          Đã đăng ký:{' '}
                          <strong className="font-medium text-sc-ink">
                            {item.enrolledCount} / {item.maxStudents} HV
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {item.coach ? (
                      <Tag color="warning" className="!m-0 font-medium">
                        Chờ duyệt
                      </Tag>
                    ) : (
                      <Tag color="error" className="!m-0 font-medium">
                        Thiếu HLV
                      </Tag>
                    )}
                    <Link
                      to="/admin/classes/$classId"
                      params={{ classId: item.id }}
                      className="hidden sm:inline-flex items-center justify-center rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
                    >
                      Duyệt
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card
        title="Tình trạng đăng ký lớp (OPEN / ONGOING)"
        className="!mt-6"
        styles={{ header: { minHeight: 54 }, body: { padding: '12px 24px 24px' } }}
      >
        <Table<GymClass>
          rowKey="id"
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
