import { PAYMENT_METHODS } from '@sports-center/shared';
import { Card, Col, Row, Tabs, type TableColumnsType } from 'antd';
import {
  ArrowLeftRight,
  Banknote,
  CalendarCheck,
  CalendarClock,
  GraduationCap,
  IdCard,
  Landmark,
  RotateCcw,
  TrendingUp,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { BarChart, type ChartDatum, type ChartSeries } from '~/components/charts/BarChart';
import { Table } from '~/components/data/Table';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { MoneyFigure } from '~/components/ui/MoneyFigure';
import { PageHeader } from '~/components/ui/PageHeader';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { StatCard } from '~/components/ui/StatCard';
import { PAYMENT_METHOD_LABEL } from '~/constants/payment';
import { ORDER_ITEM_TYPE_LABEL, ORDER_ITEM_TYPES } from '~/features/checkout/types';
import { formatDate, formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { todayVN } from '~/lib/time';
import { useOverviewReport, useRevenueReport, useWalletReport } from '../hooks/useReports';
import { REPORT_TAB_LABEL, type ReportRange, type ReportType, type RevenueBucket, type WalletBucket } from '../types';
import { defaultRange, periodLabel, periodText, REVENUE_SERIES } from '../utils';
import { CoursesReportTab } from './CoursesReportTab';
import { FacilitiesReportTab } from './FacilitiesReportTab';
import { MembersReportTab } from './MembersReportTab';
import { ReportExportActions, ReportToolbar } from './ReportToolbar';

const WALLET_SERIES: ChartSeries[] = [
  { key: 'topUpBank', label: 'Nạp chuyển khoản', color: '#16a34a' },
  { key: 'topUpCounter', label: 'Nạp tại quầy', color: '#0f4d34' },
  { key: 'payments', label: 'Thanh toán bằng ví', color: '#c94a1e' },
  { key: 'refunds', label: 'Hoàn tiền', color: '#d97706' },
];

export function OverviewTab() {
  const overview = useOverviewReport();
  const data = overview.data;
  if (overview.isError && !data) {
    return <ErrorState message={toApiError(overview.error).message} onRetry={() => void overview.refetch()} />;
  }
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} xl={8}>
        <StatCard
          loading={overview.isPending}
          icon={Banknote}
          label="Doanh thu hôm nay"
          value={<MoneyFigure amount={data?.revenueToday ?? 0} />}
        />
      </Col>
      <Col xs={24} sm={12} xl={8}>
        <StatCard
          loading={overview.isPending}
          icon={UserPlus}
          label="Thành viên mới hôm nay"
          value={data?.newMembersToday ?? 0}
        />
      </Col>
      <Col xs={24} sm={12} xl={8}>
        <StatCard
          loading={overview.isPending}
          icon={CalendarCheck}
          label="Lượt đặt sân hôm nay"
          value={data?.bookingsToday ?? 0}
        />
      </Col>
      <Col xs={24} sm={12} xl={8}>
        <StatCard
          loading={overview.isPending}
          icon={GraduationCap}
          label="Lớp đang học"
          value={data?.ongoingClasses ?? 0}
        />
      </Col>
      <Col xs={24} sm={12} xl={8}>
        <StatCard
          loading={overview.isPending}
          icon={IdCard}
          label="Gói thành viên còn hiệu lực"
          value={data?.activeMemberships ?? 0}
        />
      </Col>
      <Col xs={24} sm={12} xl={8}>
        <StatCard
          loading={overview.isPending}
          icon={Landmark}
          tone={data && data.unmatchedBankTransactions > 0 ? 'warning' : 'default'}
          label="Giao dịch ngân hàng chưa khớp"
          value={data?.unmatchedBankTransactions ?? 0}
        />
      </Col>
    </Row>
  );
}

function RevenueTab({ range }: { range: ReportRange }) {
  const report = useRevenueReport(range);
  const data = report.data;
  const buckets = useMemo(() => data?.buckets ?? [], [data]);

  const chart: ChartDatum[] = useMemo(
    () =>
      buckets.map((bucket) => ({ label: periodLabel(bucket.period, range.granularity), values: { ...bucket.byType } })),
    [buckets, range.granularity],
  );
  const totals = useMemo(
    () => ({
      revenue: buckets.reduce((sum, bucket) => sum + bucket.revenue, 0),
      refunds: buckets.reduce((sum, bucket) => sum + bucket.refunds, 0),
      byMethod: PAYMENT_METHODS.map((method) => ({
        method,
        value: buckets.reduce((sum, bucket) => sum + bucket.byPaymentMethod[method], 0),
      })),
    }),
    [buckets],
  );

  const columns: TableColumnsType<RevenueBucket> = [
    {
      title: 'Kỳ',
      dataIndex: 'period',
      render: (period: string) => (
        <span className="whitespace-nowrap font-semibold">{periodText(period, range.granularity)}</span>
      ),
    },
    ...ORDER_ITEM_TYPES.map((type) => ({
      title: ORDER_ITEM_TYPE_LABEL[type],
      key: type,
      align: 'right' as const,
      render: (_: unknown, bucket: RevenueBucket) => (
        <span className="whitespace-nowrap tabular-nums">{formatVND(bucket.byType[type])}</span>
      ),
    })),
    {
      title: 'Doanh thu',
      dataIndex: 'revenue',
      align: 'right',
      render: (value: number) => <span className="whitespace-nowrap tabular-nums">{formatVND(value)}</span>,
    },
    {
      title: 'Hoàn tiền',
      dataIndex: 'refunds',
      align: 'right',
      render: (value: number) => (
        <span className="whitespace-nowrap text-sc-error tabular-nums">{value ? `−${formatVND(value)}` : '—'}</span>
      ),
    },
    {
      title: 'Thực thu',
      dataIndex: 'net',
      align: 'right',
      render: (value: number) => <span className="whitespace-nowrap tabular-nums">{formatVND(value)}</span>,
    },
  ];

  if (report.isError && !report.data) {
    return <ErrorState message={toApiError(report.error).message} onRetry={() => void report.refetch()} />;
  }

  return (
    <div className={report.isFetching ? 'opacity-70 [transition:opacity_0.15s]' : undefined}>
      <Row gutter={[16, 16]} className="!mb-4">
        <Col xs={24} md={8}>
          <StatCard
            loading={report.isPending}
            icon={Banknote}
            label="Doanh thu"
            value={<MoneyFigure amount={totals.revenue} />}
            hint="Tổng giá trị đơn hàng đã thu trong kỳ"
          />
        </Col>
        <Col xs={24} md={8}>
          <StatCard
            loading={report.isPending}
            icon={RotateCcw}
            label="Hoàn tiền"
            value={<MoneyFigure amount={totals.refunds} />}
            hint="Tổng giá trị đã hoàn trả hội viên"
          />
        </Col>
        <Col xs={24} md={8}>
          <StatCard
            loading={report.isPending}
            icon={TrendingUp}
            label="Thực thu"
            value={<MoneyFigure amount={totals.revenue - totals.refunds} />}
            hint="Doanh thu ròng sau khi trừ hoàn tiền"
          />
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card loading={report.isPending}>
            <SectionTitle>Doanh thu theo loại dịch vụ</SectionTitle>
            {buckets.length === 0 ? (
              <EmptyState title="Chưa có dữ liệu doanh thu trong kỳ đã chọn" />
            ) : (
              <BarChart
                data={chart}
                series={REVENUE_SERIES}
                mode="stacked"
                ariaLabel="Biểu đồ doanh thu theo thời gian"
              />
            )}
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card loading={report.isPending}>
            <SectionTitle>Theo phương thức thanh toán</SectionTitle>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {totals.byMethod.map(({ method, value }) => {
                const percent = totals.revenue ? Math.round((value / totals.revenue) * 100) : 0;
                return (
                  <li key={method}>
                    <div className="mb-1 flex justify-between text-[15px]">
                      <span>{PAYMENT_METHOD_LABEL[method]}</span>
                      <b className="tabular-nums">
                        {formatVND(value)} <span className="font-normal text-sc-muted">({percent}%)</span>
                      </b>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-sc-paper-2">
                      <div className="h-full rounded-full bg-sc-primary" style={{ width: `${percent}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </Col>
      </Row>
      <Card className="!mt-4">
        <SectionTitle>Chi tiết theo kỳ</SectionTitle>
        <Table<RevenueBucket>
          rowKey="period"
          size="middle"
          columns={columns}
          dataSource={buckets}
          loading={report.isFetching && !report.data}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{ emptyText: <EmptyState title="Chưa có dữ liệu doanh thu theo kỳ" /> }}
        />
      </Card>
    </div>
  );
}

function WalletTab({ range }: { range: ReportRange }) {
  const report = useWalletReport(range);
  const data = report.data;
  const buckets = useMemo(() => data?.buckets ?? [], [data]);

  const chart: ChartDatum[] = useMemo(
    () =>
      buckets.map((bucket) => ({
        label: periodLabel(bucket.period, range.granularity),
        values: {
          topUpBank: bucket.topUpBankTransfer,
          topUpCounter: bucket.topUpCounter.CASH + bucket.topUpCounter.CARD,
          payments: bucket.payments,
          refunds: bucket.refunds,
        },
      })),
    [buckets, range.granularity],
  );
  const net = buckets.reduce((sum, bucket) => sum + bucket.netChange, 0);

  const columns: TableColumnsType<WalletBucket> = [
    {
      title: 'Kỳ',
      dataIndex: 'period',
      render: (period: string) => (
        <span className="whitespace-nowrap font-semibold">{periodText(period, range.granularity)}</span>
      ),
    },
    {
      title: 'Nạp chuyển khoản',
      dataIndex: 'topUpBankTransfer',
      align: 'right',
      render: (value: number) => <span className="whitespace-nowrap tabular-nums">{formatVND(value)}</span>,
    },
    {
      title: 'Nạp tại quầy',
      key: 'counter',
      align: 'right',
      render: (_, bucket) => (
        <span className="whitespace-nowrap tabular-nums">
          {formatVND(bucket.topUpCounter.CASH + bucket.topUpCounter.CARD)}
        </span>
      ),
    },
    {
      title: 'Thanh toán',
      dataIndex: 'payments',
      align: 'right',
      render: (value: number) => <span className="whitespace-nowrap tabular-nums">−{formatVND(value)}</span>,
    },
    {
      title: 'Hoàn tiền',
      dataIndex: 'refunds',
      align: 'right',
      render: (value: number) => <span className="whitespace-nowrap tabular-nums">+{formatVND(value)}</span>,
    },
    {
      title: 'Biến động ròng',
      dataIndex: 'netChange',
      align: 'right',
      render: (value: number) => (
        <span
          className={`whitespace-nowrap font-medium tabular-nums ${value < 0 ? 'text-sc-error' : 'text-sc-success'}`}
        >
          {value > 0 ? '+' : ''}
          {formatVND(value)}
        </span>
      ),
    },
  ];

  if (report.isError && !report.data) {
    return <ErrorState message={toApiError(report.error).message} onRetry={() => void report.refetch()} />;
  }

  return (
    <div className={report.isFetching ? 'opacity-70 [transition:opacity_0.15s]' : undefined}>
      <Row gutter={[16, 16]} className="!mb-4">
        <Col xs={24} md={8}>
          <StatCard
            loading={report.isPending}
            icon={Wallet}
            label="Tổng số dư ví"
            value={<MoneyFigure amount={report.data?.totalBalance ?? 0} />}
            hint="Tổng số dư khả dụng của toàn bộ ví hội viên"
          />
        </Col>
        <Col xs={24} md={8}>
          <StatCard
            loading={report.isPending}
            icon={ArrowLeftRight}
            label="Biến động ròng trong kỳ"
            value={`${net > 0 ? '+' : ''}${formatVND(net)}`}
            hint="Chênh lệch giữa tiền nạp/hoàn và chi tiêu"
          />
        </Col>
        <Col xs={24} md={8}>
          <StatCard
            loading={report.isPending}
            icon={Landmark}
            tone={report.data && report.data.unmatched.count > 0 ? 'warning' : 'default'}
            label="Tiền vào chưa khớp"
            value={<MoneyFigure amount={report.data?.unmatched.amount ?? 0} />}
            hint={
              report.data && report.data.unmatched.count > 0
                ? `${report.data.unmatched.count} giao dịch ngân hàng cần đối soát`
                : 'Tất cả giao dịch chuyển khoản đã khớp'
            }
          />
        </Col>
      </Row>
      <Card loading={report.isPending}>
        <SectionTitle>Dòng tiền ví theo thời gian</SectionTitle>
        {buckets.length === 0 ? (
          <EmptyState title="Chưa có biến động dòng tiền ví trong kỳ đã chọn" />
        ) : (
          <BarChart
            data={chart}
            series={WALLET_SERIES}
            mode="grouped"
            ariaLabel="Biểu đồ dòng tiền ví theo thời gian"
          />
        )}
      </Card>
      <Card className="!mt-4">
        <SectionTitle>Chi tiết theo kỳ</SectionTitle>
        <Table<WalletBucket>
          rowKey="period"
          size="middle"
          columns={columns}
          dataSource={buckets}
          loading={report.isFetching && !report.data}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{ emptyText: <EmptyState title="Chưa có dữ liệu dòng tiền ví theo kỳ" /> }}
        />
      </Card>
    </div>
  );
}

/** `/admin/reports`: overview, revenue, wallet, members, facilities and courses reports with Excel/PDF export. */
export function ReportsPage() {
  const [tab, setTab] = useState<ReportType>('overview');
  const [range, setRange] = useState<ReportRange>(defaultRange);
  const today = todayVN();

  return (
    <>
      <PageHeader
        title="Báo cáo"
        description="Theo dõi vận hành, doanh thu, dòng tiền ví, hội viên, công suất sân và chất lượng lớp học."
      />
      <Card>
        <Tabs
          activeKey={tab}
          onChange={(next) => setTab(next as ReportType)}
          items={[
            {
              key: 'overview',
              label: REPORT_TAB_LABEL.overview,
              children: (
                <>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sc-border-soft bg-sc-paper/45 px-3.5 py-2.5">
                    <span className="inline-flex items-center gap-2 text-[14px] font-medium text-sc-muted">
                      <CalendarClock size={15} className="text-sc-primary" />
                      Số liệu vận hành trong ngày hôm nay ({formatDate(today)}) · Tự động cập nhật mỗi 60 giây
                    </span>
                    <ReportExportActions report="overview" range={range} />
                  </div>
                  <OverviewTab />
                </>
              ),
            },
            {
              key: 'revenue',
              label: REPORT_TAB_LABEL.revenue,
              children: (
                <>
                  <ReportToolbar range={range} onChange={setRange} report="revenue" />
                  <RevenueTab range={range} />
                </>
              ),
            },
            {
              key: 'wallet',
              label: REPORT_TAB_LABEL.wallet,
              children: (
                <>
                  <ReportToolbar range={range} onChange={setRange} report="wallet" />
                  <WalletTab range={range} />
                </>
              ),
            },
            {
              key: 'members',
              label: REPORT_TAB_LABEL.members,
              children: (
                <>
                  <ReportToolbar range={range} onChange={setRange} report="members" />
                  <MembersReportTab range={range} />
                </>
              ),
            },
            {
              key: 'facilities',
              label: REPORT_TAB_LABEL.facilities,
              children: (
                <>
                  <ReportToolbar range={range} onChange={setRange} report="facilities" showGranularity={false} />
                  <FacilitiesReportTab range={range} />
                </>
              ),
            },
            {
              key: 'courses',
              label: REPORT_TAB_LABEL.courses,
              children: (
                <>
                  <ReportToolbar range={range} onChange={setRange} report="courses" showGranularity={false} />
                  <CoursesReportTab range={range} />
                </>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
