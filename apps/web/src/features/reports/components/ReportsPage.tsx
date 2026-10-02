import { Link } from '@tanstack/react-router';
import { Alert, Card, Col, Row, Table, Tabs, type TableColumnsType } from 'antd';
import { Banknote, CalendarCheck, GraduationCap, IdCard, Landmark, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BarChart, type ChartDatum, type ChartSeries } from '~/components/charts/BarChart';
import { ErrorState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { StatCard } from '~/components/ui/StatCard';
import { PAYMENT_METHOD_LABEL } from '~/constants/payment';
import { ORDER_ITEM_TYPES, ORDER_ITEM_TYPE_LABEL } from '~/features/checkout/types';
import { formatDate, formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { parseDate } from '~/lib/time';
import { useOverviewReport, useRevenueReport, useWalletReport } from '../hooks/useReports';
import type { Granularity, ReportRange, RevenueBucket, WalletBucket } from '../types';
import { defaultRange } from '../utils';
import { ReportToolbar } from './ReportToolbar';

function periodLabel(period: string, granularity: Granularity) {
  if (granularity === 'month') return parseDate(`${period}-01`).format('MM/YYYY');
  const date = parseDate(period).format('DD/MM');
  return granularity === 'week' ? `Tuần ${date}` : date;
}

function periodText(period: string, granularity: Granularity) {
  if (granularity === 'month') return `Tháng ${parseDate(`${period}-01`).format('MM/YYYY')}`;
  if (granularity === 'week') return `Tuần từ ${formatDate(period)}`;
  return formatDate(period);
}

const TYPE_COLOR = {
  MEMBERSHIP: '#9333ea',
  FACILITY_BOOKING: '#0f4d34',
  FACILITY_PACKAGE: '#06b6d4',
  COURSE_ENROLLMENT: '#c94a1e',
} as const;
const REVENUE_SERIES: ChartSeries[] = ORDER_ITEM_TYPES.map((type) => ({
  key: type,
  label: ORDER_ITEM_TYPE_LABEL[type],
  color: TYPE_COLOR[type],
}));

const WALLET_SERIES: ChartSeries[] = [
  { key: 'topUpBank', label: 'Nạp chuyển khoản', color: '#16a34a' },
  { key: 'topUpCounter', label: 'Nạp tại quầy', color: '#0f4d34' },
  { key: 'payments', label: 'Thanh toán bằng ví', color: '#c94a1e' },
  { key: 'refunds', label: 'Hoàn tiền', color: '#d97706' },
];

function OverviewTab() {
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
          value={formatVND(data?.revenueToday ?? 0)}
          hint="Không gồm nạp ví, đã trừ hoàn tiền"
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
          hint={
            <Link to="/admin/bank-transactions" className="font-semibold underline underline-offset-2">
              Đối soát ngay
            </Link>
          }
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
      byMethod: (['WALLET', 'CASH', 'CARD', 'TRANSFER'] as const).map((method) => ({
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
      render: (period: string) => <b className="whitespace-nowrap">{periodText(period, range.granularity)}</b>,
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
      render: (value: number) => <b className="whitespace-nowrap tabular-nums">{formatVND(value)}</b>,
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
      render: (value: number) => <b className="whitespace-nowrap tabular-nums">{formatVND(value)}</b>,
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
            label="Doanh thu"
            value={formatVND(totals.revenue)}
            hint="Tính theo thời điểm thanh toán · không gồm nạp ví"
          />
        </Col>
        <Col xs={24} md={8}>
          <StatCard
            loading={report.isPending}
            label="Hoàn tiền"
            value={formatVND(totals.refunds)}
            hint="Tính tại thời điểm hoàn"
          />
        </Col>
        <Col xs={24} md={8}>
          <StatCard loading={report.isPending} label="Thực thu" value={formatVND(totals.revenue - totals.refunds)} />
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card loading={report.isPending}>
            <SectionTitle>Doanh thu theo loại dịch vụ</SectionTitle>
            <BarChart
              data={chart}
              series={REVENUE_SERIES}
              mode="stacked"
              ariaLabel="Biểu đồ doanh thu theo thời gian"
            />
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
                    <div className="mb-1 flex justify-between text-[13.5px]">
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
          scroll={{ x: 'max-content' }}
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
          topUpCounter: bucket.topUpCounter.CASH + bucket.topUpCounter.CARD + bucket.topUpCounter.TRANSFER,
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
      render: (period: string) => <b className="whitespace-nowrap">{periodText(period, range.granularity)}</b>,
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
          {formatVND(bucket.topUpCounter.CASH + bucket.topUpCounter.CARD + bucket.topUpCounter.TRANSFER)}
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
        <b className={`whitespace-nowrap tabular-nums ${value < 0 ? 'text-sc-error' : 'text-sc-success'}`}>
          {value > 0 ? '+' : ''}
          {formatVND(value)}
        </b>
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
            label="Tổng số dư ví"
            value={formatVND(report.data?.totalBalance ?? 0)}
            hint="Của mọi thành viên, tại thời điểm xem"
          />
        </Col>
        <Col xs={24} md={8}>
          <StatCard
            loading={report.isPending}
            label="Biến động ròng trong kỳ"
            value={`${net > 0 ? '+' : ''}${formatVND(net)}`}
            hint="Nạp − thanh toán + hoàn"
          />
        </Col>
        <Col xs={24} md={8}>
          <StatCard
            loading={report.isPending}
            tone={report.data && report.data.unmatched.count > 0 ? 'warning' : 'default'}
            label="Tiền vào chưa khớp"
            value={formatVND(report.data?.unmatched.amount ?? 0)}
            hint={
              <>
                {report.data?.unmatched.count ?? 0} giao dịch ·{' '}
                <Link to="/admin/bank-transactions" className="font-semibold underline underline-offset-2">
                  Đối soát
                </Link>
              </>
            }
          />
        </Col>
      </Row>
      <Card loading={report.isPending}>
        <SectionTitle>Dòng tiền ví theo thời gian</SectionTitle>
        <BarChart data={chart} series={WALLET_SERIES} mode="grouped" ariaLabel="Biểu đồ dòng tiền ví theo thời gian" />
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
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </div>
  );
}

/** `/admin/reports`: overview cards, revenue and wallet cash-flow charts with a date range and day/week/month unit. */
export function ReportsPage() {
  const [tab, setTab] = useState('overview');
  const [range, setRange] = useState<ReportRange>(defaultRange);

  return (
    <>
      <PageHeader
        title="Báo cáo"
        description="Doanh thu tính theo thời điểm thanh toán, không gồm nạp ví. Báo cáo thành viên, sân, khóa học và xuất file sẽ bổ sung sau."
      />
      <Alert
        type="info"
        showIcon
        className="!mb-4"
        title="Số liệu báo cáo đang là dữ liệu mẫu cho các ngày trước hôm nay, cộng thêm đơn hàng phát sinh trên trình duyệt này, cho tới khi API báo cáo (#128) sẵn sàng."
      />
      <Card>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            { key: 'overview', label: 'Tổng quan', children: <OverviewTab /> },
            {
              key: 'revenue',
              label: 'Doanh thu',
              children: (
                <>
                  <ReportToolbar range={range} onChange={setRange} />
                  <RevenueTab range={range} />
                </>
              ),
            },
            {
              key: 'wallet',
              label: 'Dòng tiền ví',
              children: (
                <>
                  <ReportToolbar range={range} onChange={setRange} />
                  <WalletTab range={range} />
                </>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
