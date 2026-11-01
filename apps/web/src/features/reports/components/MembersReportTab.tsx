import { ACCOUNT_STATUSES } from '@sports-center/shared';
import { Link } from '@tanstack/react-router';
import { Button, Card, Col, Row, Tag, type TableColumnsType } from 'antd';
import { ArrowUpRight, IdCard, RefreshCw, TriangleAlert, UserPlus, Users } from 'lucide-react';
import { useMemo } from 'react';
import { BarChart, type ChartDatum, type ChartSeries } from '~/components/charts/BarChart';
import { Table } from '~/components/data/Table';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { StatCard } from '~/components/ui/StatCard';
import { toApiError } from '~/lib/http-errors';
import { useMembersReport } from '../hooks/useReports';
import { ACCOUNT_STATUS_REPORT_META, type ReportRange } from '../types';
import {
  formatCount,
  formatPercent,
  groupNewMembersByPeriod,
  periodLabel,
  periodText,
  type NewMemberBucket,
} from '../utils';

const NEW_MEMBER_SERIES: ChartSeries[] = [{ key: 'count', label: 'Hội viên đăng ký mới', color: '#0f4d34' }];

interface MembersReportTabProps {
  range: ReportRange;
}

/** `/admin/reports` -> "Hội viên": account status breakdown, membership retention/expiry and new sign-ups by period. */
export function MembersReportTab({ range }: MembersReportTabProps) {
  const report = useMembersReport(range);
  const data = report.data;

  const buckets = useMemo(
    () => groupNewMembersByPeriod(data?.newByPeriod ?? [], range.granularity),
    [data?.newByPeriod, range.granularity],
  );

  const newInRange = useMemo(() => buckets.reduce((sum, item) => sum + item.count, 0), [buckets]);

  const peakBucket = useMemo(
    () => buckets.reduce<NewMemberBucket | null>((best, cur) => (!best || cur.count > best.count ? cur : best), null),
    [buckets],
  );

  const chart: ChartDatum[] = useMemo(
    () =>
      buckets.map((bucket) => ({
        label: periodLabel(bucket.period, range.granularity),
        values: { count: bucket.count },
      })),
    [buckets, range.granularity],
  );

  if (report.isError && !data) {
    return <ErrorState message={toApiError(report.error).message} onRetry={() => void report.refetch()} />;
  }

  const totalMembers = data?.total ?? 0;
  const activeMemberships = data?.activeMemberships ?? 0;
  const expiringSoon = data?.expiringSoon ?? 0;
  const membershipCoverage = totalMembers > 0 ? Math.round((activeMemberships / totalMembers) * 1000) / 10 : 0;

  const columns: TableColumnsType<NewMemberBucket> = [
    {
      title: 'Kỳ',
      dataIndex: 'period',
      render: (period: string) => (
        <span className="whitespace-nowrap font-semibold">{periodText(period, range.granularity)}</span>
      ),
    },
    {
      title: 'Hội viên mới',
      dataIndex: 'count',
      align: 'right',
      render: (count: number) =>
        count > 0 ? (
          <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap text-sc-success tabular-nums">
            +{formatCount(count)}
          </span>
        ) : (
          <span className="whitespace-nowrap text-sc-muted-2 tabular-nums">0</span>
        ),
    },
    {
      title: 'Tỷ trọng trong kỳ',
      key: 'share',
      width: 220,
      render: (_, bucket) => {
        const share = newInRange > 0 ? Math.round((bucket.count / newInRange) * 1000) / 10 : 0;
        return (
          <div className="flex items-center gap-2.5">
            <div className="h-2 min-w-20 flex-1 overflow-hidden rounded-full bg-sc-paper-2">
              <div className="h-full rounded-full bg-sc-primary" style={{ width: `${Math.min(100, share)}%` }} />
            </div>
            <span className="w-12 text-right text-[13.5px] whitespace-nowrap text-sc-muted tabular-nums">
              {formatPercent(share)}
            </span>
          </div>
        );
      },
    },
    {
      title: 'Lũy kế trong kỳ',
      dataIndex: 'cumulative',
      align: 'right',
      render: (cumulative: number) => (
        <span className="font-medium whitespace-nowrap tabular-nums">{formatCount(cumulative)}</span>
      ),
    },
  ];

  return (
    <div className={report.isFetching ? 'opacity-70 [transition:opacity_0.15s]' : undefined}>
      <Row gutter={[16, 16]} className="!mb-4">
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={report.isPending}
            icon={Users}
            label="Tổng hội viên"
            value={formatCount(totalMembers)}
            hint={`+${formatCount(newInRange)} đăng ký mới trong kỳ`}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={report.isPending}
            icon={IdCard}
            label="Gói đang hiệu lực"
            value={formatCount(activeMemberships)}
            hint={`Chiếm ${formatPercent(membershipCoverage)} tổng hội viên`}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={report.isPending}
            icon={TriangleAlert}
            tone={expiringSoon > 0 ? 'warning' : 'default'}
            label="Gói sắp hết hạn"
            value={formatCount(expiringSoon)}
            hint={expiringSoon > 0 ? 'Cần chủ động nhắc gia hạn' : 'Không có gói sắp hết hạn'}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={report.isPending}
            icon={RefreshCw}
            label="Tỷ lệ gia hạn"
            value={formatPercent(data?.renewalRate ?? 0)}
            hint="Tính trên các kỳ gói kết thúc"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card loading={report.isPending}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <SectionTitle>Hội viên đăng ký mới theo thời gian</SectionTitle>
              {peakBucket && peakBucket.count > 0 && (
                <span className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-sc-primary-soft px-2.5 py-1 text-[13.5px] font-medium text-sc-primary">
                  <UserPlus size={14} />
                  Cao nhất: {periodText(peakBucket.period, range.granularity)} (+{formatCount(peakBucket.count)})
                </span>
              )}
            </div>
            {buckets.length === 0 ? (
              <EmptyState title="Chưa có dữ liệu kỳ báo cáo" />
            ) : (
              <BarChart
                data={chart}
                series={NEW_MEMBER_SERIES}
                mode="grouped"
                format={(value) => `${formatCount(value)} hội viên`}
                ariaLabel="Biểu đồ số lượng hội viên đăng ký mới theo thời gian"
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card loading={report.isPending} className="h-full">
            <div className="flex items-start justify-between gap-2">
              <SectionTitle>Trạng thái tài khoản</SectionTitle>
              <Link to="/admin/users">
                <Button type="link" size="small" className="!px-0" icon={<ArrowUpRight size={14} />}>
                  Người dùng
                </Button>
              </Link>
            </div>
            <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
              {ACCOUNT_STATUSES.map((status) => {
                const meta = ACCOUNT_STATUS_REPORT_META[status];
                const count = data?.byStatus[status] ?? 0;
                const percent = totalMembers > 0 ? Math.round((count / totalMembers) * 1000) / 10 : 0;
                return (
                  <li key={status}>
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-[15px]">
                      <span className="inline-flex items-center gap-2">
                        <Tag color={meta.tagColor} className="!m-0">
                          {meta.label}
                        </Tag>
                      </span>
                      <b className="tabular-nums">
                        {formatCount(count)}{' '}
                        <span className="font-normal text-sc-muted">({formatPercent(percent)})</span>
                      </b>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-sc-paper-2">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, percent)}%`, backgroundColor: meta.barColor }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 rounded-xl border border-sc-border-soft bg-sc-paper/60 p-3 text-[14px] text-sc-muted">
              Trong khoảng thời gian đã chọn có <b className="text-sc-ink">{formatCount(newInRange)}</b> hội viên mới
              đăng ký trên tổng số <b className="text-sc-ink">{formatCount(totalMembers)}</b> tài khoản hội viên.
            </div>
          </Card>
        </Col>
      </Row>

      <Card className="!mt-4">
        <SectionTitle>Chi tiết hội viên mới theo kỳ</SectionTitle>
        <Table<NewMemberBucket>
          rowKey="period"
          size="middle"
          columns={columns}
          dataSource={buckets}
          loading={report.isFetching && !data}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{ emptyText: <EmptyState title="Chưa có hội viên đăng ký mới trong kỳ này" /> }}
        />
      </Card>
    </div>
  );
}
