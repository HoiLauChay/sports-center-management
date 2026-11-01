import { Link } from '@tanstack/react-router';
import { Button, Card, Col, Row, Tag, type TableColumnsType } from 'antd';
import { ArrowUpRight, Banknote, CalendarCheck, Gauge, MapPin } from 'lucide-react';
import { useMemo } from 'react';
import { BarChart, type ChartDatum, type ChartSeries } from '~/components/charts/BarChart';
import { Table } from '~/components/data/Table';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { MoneyFigure } from '~/components/ui/MoneyFigure';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { StatCard } from '~/components/ui/StatCard';
import { formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useFacilitiesReport } from '../hooks/useReports';
import type { FacilitiesReport, ReportRange } from '../types';
import { formatCount, formatPercent } from '../utils';

type FacilityRow = FacilitiesReport['byFacility'][number];

const OCCUPANCY_SERIES: ChartSeries[] = [{ key: 'occupancyPct', label: 'Công suất lấp đầy (%)', color: '#0f4d34' }];

function occupancyTone(pct: number): { bar: string; tagColor: string; label: string } {
  if (pct >= 70) return { bar: '#16a34a', tagColor: 'success', label: 'Cao' };
  if (pct >= 35) return { bar: '#0f4d34', tagColor: 'processing', label: 'Ổn định' };
  if (pct > 0) return { bar: '#d97706', tagColor: 'warning', label: 'Thấp' };
  return { bar: '#94a3b8', tagColor: 'default', label: 'Trống' };
}

interface FacilitiesReportTabProps {
  range: Pick<ReportRange, 'from' | 'to'>;
}

/** `/admin/reports` -> "Sân & phòng": overall utilization, per-facility occupancy bar chart, revenue share and table. */
export function FacilitiesReportTab({ range }: FacilitiesReportTabProps) {
  const report = useFacilitiesReport(range);
  const data = report.data;
  const rows = useMemo(() => data?.byFacility ?? [], [data?.byFacility]);

  const { totalBookings, totalRevenue, topOccupancy, rankedByRevenue } = useMemo(() => {
    const bookings = rows.reduce((sum, item) => sum + item.bookings, 0);
    const revenue = rows.reduce((sum, item) => sum + item.revenue, 0);
    const busiest = rows.reduce<FacilityRow | null>(
      (best, cur) =>
        !best ||
        cur.occupancyPct > best.occupancyPct ||
        (cur.occupancyPct === best.occupancyPct && cur.bookings > best.bookings)
          ? cur
          : best,
      null,
    );
    const byRev = [...rows].sort((a, b) => b.revenue - a.revenue || b.occupancyPct - a.occupancyPct);
    return {
      totalBookings: bookings,
      totalRevenue: revenue,
      topOccupancy: busiest && (busiest.occupancyPct > 0 || busiest.bookings > 0) ? busiest : null,
      rankedByRevenue: byRev,
    };
  }, [rows]);

  const chart: ChartDatum[] = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.occupancyPct - a.occupancyPct || b.revenue - a.revenue)
        .map((item) => ({
          label: item.name,
          tooltipLabel: item.name,
          values: { occupancyPct: item.occupancyPct },
        })),
    [rows],
  );

  if (report.isError && !data) {
    return <ErrorState message={toApiError(report.error).message} onRetry={() => void report.refetch()} />;
  }

  const columns: TableColumnsType<FacilityRow> = [
    {
      title: '#',
      key: 'rank',
      width: 56,
      render: (_, __, index) => (
        <span className="font-display text-lg font-extrabold text-sc-muted-2">
          {String(index + 1).padStart(2, '0')}
        </span>
      ),
    },
    {
      title: 'Sân & phòng',
      dataIndex: 'name',
      render: (name: string, row) => {
        const tone = occupancyTone(row.occupancyPct);
        return (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sc-ink">{name}</span>
            <Tag color={tone.tagColor} className="!m-0">
              {tone.label}
            </Tag>
          </div>
        );
      },
    },
    {
      title: 'Lượt đặt',
      dataIndex: 'bookings',
      align: 'right',
      sorter: (a, b) => a.bookings - b.bookings,
      render: (bookings: number) => (
        <span className="font-medium whitespace-nowrap tabular-nums">{formatCount(bookings)}</span>
      ),
    },
    {
      title: 'Công suất lấp đầy',
      dataIndex: 'occupancyPct',
      width: 240,
      sorter: (a, b) => a.occupancyPct - b.occupancyPct,
      render: (pct: number) => {
        const tone = occupancyTone(pct);
        return (
          <div className="flex items-center gap-2.5">
            <div className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-sc-paper-2">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(100, pct)}%`, backgroundColor: tone.bar }}
              />
            </div>
            <span className="w-14 text-right font-semibold whitespace-nowrap tabular-nums">{formatPercent(pct)}</span>
          </div>
        );
      },
    },
    {
      title: 'Doanh thu',
      dataIndex: 'revenue',
      align: 'right',
      defaultSortOrder: 'descend',
      sorter: (a, b) => a.revenue - b.revenue,
      render: (revenue: number) => (
        <span className="font-semibold whitespace-nowrap tabular-nums">{formatVND(revenue)}</span>
      ),
    },
    {
      title: 'Tỷ trọng thu',
      key: 'share',
      align: 'right',
      render: (_, row) => {
        const share = totalRevenue > 0 ? Math.round((row.revenue / totalRevenue) * 1000) / 10 : 0;
        return <span className="whitespace-nowrap text-sc-muted tabular-nums">{formatPercent(share)}</span>;
      },
    },
  ];

  return (
    <div className={report.isFetching ? 'opacity-70 [transition:opacity_0.15s]' : undefined}>
      <Row gutter={[16, 16]} className="!mb-4">
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={report.isPending}
            icon={Gauge}
            label="Công suất chung"
            value={formatPercent(data?.utilizationRate ?? 0)}
            hint={`Tính trên ${formatCount(rows.length)} sân & phòng`}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={report.isPending}
            icon={CalendarCheck}
            label="Tổng lượt đặt sân"
            value={formatCount(totalBookings)}
            hint="Các lượt đặt đã xác nhận trong kỳ"
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={report.isPending}
            icon={Banknote}
            label="Doanh thu sân"
            value={<MoneyFigure amount={totalRevenue} />}
            hint="Đặt sân lẻ và gói sân định kỳ"
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={report.isPending}
            icon={MapPin}
            label="Khai thác cao nhất"
            value={
              topOccupancy ? (
                <span className="block truncate text-[clamp(20px,1.65vw,26px)] leading-tight" title={topOccupancy.name}>
                  {topOccupancy.name}
                </span>
              ) : (
                '—'
              )
            }
            hint={
              topOccupancy
                ? topOccupancy.bookings > 0
                  ? `${formatPercent(topOccupancy.occupancyPct)} · ${formatCount(topOccupancy.bookings)} lượt đặt`
                  : `${formatPercent(topOccupancy.occupancyPct)} công suất (lịch lớp & sân)`
                : 'Chưa phát sinh lượt sử dụng'
            }
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card loading={report.isPending}>
            <SectionTitle>Công suất lấp đầy theo sân & phòng</SectionTitle>
            {rows.length === 0 ? (
              <EmptyState title="Chưa có sân hoặc phòng hoạt động trong kỳ" />
            ) : (
              <BarChart
                data={chart}
                series={OCCUPANCY_SERIES}
                mode="grouped"
                format={formatPercent}
                ariaLabel="Biểu đồ tỷ lệ công suất lấp đầy theo từng sân và phòng"
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card loading={report.isPending} className="h-full">
            <div className="flex items-start justify-between gap-2">
              <SectionTitle>Đóng góp doanh thu</SectionTitle>
              <Link to="/admin/facilities">
                <Button type="link" size="small" className="!px-0" icon={<ArrowUpRight size={14} />}>
                  Danh mục sân
                </Button>
              </Link>
            </div>
            {rankedByRevenue.length === 0 ? (
              <EmptyState title="Chưa có dữ liệu doanh thu sân" />
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {rankedByRevenue.slice(0, 6).map((facility) => {
                  const share = totalRevenue > 0 ? Math.round((facility.revenue / totalRevenue) * 1000) / 10 : 0;
                  return (
                    <li key={facility.facilityId}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-[14.5px]">
                        <span className="truncate font-medium text-sc-ink">{facility.name}</span>
                        <b className="whitespace-nowrap tabular-nums">
                          {formatVND(facility.revenue)}{' '}
                          <span className="font-normal text-sc-muted">({formatPercent(share)})</span>
                        </b>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-sc-paper-2">
                        <div
                          className="h-full rounded-full bg-sc-primary"
                          style={{ width: `${Math.min(100, share)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </Col>
      </Row>

      <Card className="!mt-4">
        <SectionTitle>Chi tiết theo sân & phòng</SectionTitle>
        <Table<FacilityRow>
          rowKey="facilityId"
          size="middle"
          columns={columns}
          dataSource={rows}
          loading={report.isFetching && !data}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{ emptyText: <EmptyState title="Chưa có dữ liệu sân & phòng trong khoảng thời gian này" /> }}
        />
      </Card>
    </div>
  );
}
