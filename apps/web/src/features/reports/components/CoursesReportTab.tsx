import { Link } from '@tanstack/react-router';
import { Button, Card, Col, Row, Tag, type TableColumnsType } from 'antd';
import { ArrowUpRight, Award, ClipboardCheck, GraduationCap, Users } from 'lucide-react';
import { useMemo } from 'react';
import { BarChart, type ChartDatum, type ChartSeries } from '~/components/charts/BarChart';
import { Table } from '~/components/data/Table';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { StatCard } from '~/components/ui/StatCard';
import { initialsOf } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useCoursesReport } from '../hooks/useReports';
import type { CoursesReport, ReportRange } from '../types';
import { formatCount, formatPercent } from '../utils';

type ClassRow = CoursesReport['byClass'][number];

const COURSE_SERIES: ChartSeries[] = [
  { key: 'fillRate', label: 'Tỷ lệ lấp đầy (%)', color: '#0f4d34' },
  { key: 'attendanceRate', label: 'Tỷ lệ chuyên cần (%)', color: '#06b6d4' },
];

function rateBarColor(pct: number): string {
  if (pct >= 75) return '#16a34a';
  if (pct >= 45) return '#0f4d34';
  if (pct > 0) return '#d97706';
  return '#94a3b8';
}

interface CoursesReportTabProps {
  range: Pick<ReportRange, 'from' | 'to'>;
}

/** `/admin/reports` -> "Khóa & lớp học": class fill rates, student attendance rates and top coaches leaderboard. */
export function CoursesReportTab({ range }: CoursesReportTabProps) {
  const report = useCoursesReport(range);
  const data = report.data;
  const classes = useMemo(() => data?.byClass ?? [], [data?.byClass]);
  const topCoaches = useMemo(() => data?.topCoaches ?? [], [data?.topCoaches]);

  const { totalEnrolled, totalCapacity, avgFillRate, avgAttendanceRate } = useMemo(() => {
    const enrolled = classes.reduce((sum, item) => sum + item.enrolled, 0);
    const capacity = classes.reduce((sum, item) => sum + item.max, 0);
    const fill =
      classes.length > 0
        ? Math.round((classes.reduce((sum, item) => sum + item.fillRate, 0) / classes.length) * 10) / 10
        : 0;
    const activeAttendance = classes.filter((item) => item.attendanceRate > 0);
    const attendance =
      activeAttendance.length > 0
        ? Math.round(
            (activeAttendance.reduce((sum, item) => sum + item.attendanceRate, 0) / activeAttendance.length) * 10,
          ) / 10
        : 0;
    return {
      totalEnrolled: enrolled,
      totalCapacity: capacity,
      avgFillRate: fill,
      avgAttendanceRate: attendance,
    };
  }, [classes]);

  const chart: ChartDatum[] = useMemo(
    () =>
      [...classes]
        .sort((a, b) => b.fillRate - a.fillRate || b.attendanceRate - a.attendanceRate)
        .slice(0, 12)
        .map((cls) => ({
          label: cls.name,
          tooltipLabel: cls.name,
          values: {
            fillRate: cls.fillRate,
            attendanceRate: cls.attendanceRate,
          },
        })),
    [classes],
  );

  if (report.isError && !data) {
    return <ErrorState message={toApiError(report.error).message} onRetry={() => void report.refetch()} />;
  }

  const topCoach = topCoaches[0] ?? null;
  const maxCoachStudents = topCoach?.students ?? 0;

  const columns: TableColumnsType<ClassRow> = [
    {
      title: '#',
      key: 'index',
      width: 56,
      render: (_, __, index) => (
        <span className="font-display text-lg font-extrabold text-sc-muted-2">
          {String(index + 1).padStart(2, '0')}
        </span>
      ),
    },
    {
      title: 'Lớp học',
      dataIndex: 'name',
      render: (name: string, row) => (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/classes/$classId"
            params={{ classId: row.classId }}
            className="font-semibold text-sc-ink hover:text-sc-primary"
          >
            {name}
          </Link>
          {row.enrolled >= row.max && row.max > 0 && (
            <Tag color="success" className="!m-0">
              Đủ sĩ số
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Sĩ số',
      key: 'capacity',
      align: 'right',
      sorter: (a, b) => a.enrolled - b.enrolled,
      render: (_, row) => (
        <span className="font-medium whitespace-nowrap tabular-nums">
          {formatCount(row.enrolled)}/{formatCount(row.max)}
        </span>
      ),
    },
    {
      title: 'Tỷ lệ lấp đầy',
      dataIndex: 'fillRate',
      width: 220,
      sorter: (a, b) => a.fillRate - b.fillRate,
      render: (pct: number) => (
        <div className="flex items-center gap-2.5">
          <div className="h-2 min-w-20 flex-1 overflow-hidden rounded-full bg-sc-paper-2">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, pct)}%`, backgroundColor: rateBarColor(pct) }}
            />
          </div>
          <span className="w-14 text-right font-semibold whitespace-nowrap tabular-nums">{formatPercent(pct)}</span>
        </div>
      ),
    },
    {
      title: 'Tỷ lệ chuyên cần',
      dataIndex: 'attendanceRate',
      width: 220,
      sorter: (a, b) => a.attendanceRate - b.attendanceRate,
      render: (pct: number) => (
        <div className="flex items-center gap-2.5">
          <div className="h-2 min-w-20 flex-1 overflow-hidden rounded-full bg-sc-paper-2">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, pct)}%`, backgroundColor: '#06b6d4' }}
            />
          </div>
          <span className="w-14 text-right font-semibold whitespace-nowrap tabular-nums">{formatPercent(pct)}</span>
        </div>
      ),
    },
  ];

  return (
    <div className={report.isFetching ? 'opacity-70 [transition:opacity_0.15s]' : undefined}>
      <Row gutter={[16, 16]} className="!mb-4">
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={report.isPending}
            icon={GraduationCap}
            label="Lớp hoạt động trong kỳ"
            value={formatCount(classes.length)}
            hint={`${formatCount(totalEnrolled)} lượt học viên đăng ký`}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={report.isPending}
            icon={Users}
            label="Tỷ lệ lấp đầy TB"
            value={formatPercent(avgFillRate)}
            hint={`${formatCount(totalEnrolled)}/${formatCount(totalCapacity)} tổng chỉ tiêu`}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={report.isPending}
            icon={ClipboardCheck}
            label="Chuyên cần TB"
            value={formatPercent(avgAttendanceRate)}
            hint="Tính trên các lớp đã có buổi điểm danh"
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={report.isPending}
            icon={Award}
            label="HLV đông học viên nhất"
            value={
              topCoach ? (
                <span
                  className="block truncate text-[clamp(20px,1.65vw,26px)] leading-tight"
                  title={topCoach.coach.fullName}
                >
                  {topCoach.coach.fullName}
                </span>
              ) : (
                '—'
              )
            }
            hint={topCoach ? `${formatCount(topCoach.students)} học viên theo học` : 'Chưa có dữ liệu giảng dạy'}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card loading={report.isPending}>
            <SectionTitle>So sánh lấp đầy & chuyên cần theo lớp</SectionTitle>
            {classes.length === 0 ? (
              <EmptyState title="Chưa có lớp học nào diễn ra trong khoảng thời gian đã chọn" />
            ) : (
              <BarChart
                data={chart}
                series={COURSE_SERIES}
                mode="grouped"
                format={formatPercent}
                ariaLabel="Biểu đồ tỷ lệ lấp đầy và chuyên cần của các lớp học"
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card loading={report.isPending} className="h-full">
            <div className="flex items-start justify-between gap-2">
              <SectionTitle>Xếp hạng huấn luyện viên</SectionTitle>
              <Link to="/admin/classes">
                <Button type="link" size="small" className="!px-0" icon={<ArrowUpRight size={14} />}>
                  Quản lý lớp
                </Button>
              </Link>
            </div>
            {topCoaches.length === 0 ? (
              <EmptyState title="Chưa có dữ liệu huấn luyện viên" />
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
                {topCoaches.slice(0, 6).map(({ coach, students }, index) => {
                  const pct = maxCoachStudents > 0 ? Math.round((students / maxCoachStudents) * 100) : 0;
                  return (
                    <li key={coach.id} className="flex items-center gap-3">
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-lg font-display text-[14px] font-extrabold ${
                          index === 0 ? 'bg-sc-lime text-sc-ink' : 'bg-sc-paper-2 text-sc-ink-2'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sc-primary-soft text-[13px] font-bold text-sc-primary">
                        {initialsOf(coach.fullName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center justify-between gap-2 text-[14.5px]">
                          <Link
                            to="/admin/users/$userId"
                            params={{ userId: coach.id }}
                            className="truncate font-semibold text-sc-ink hover:text-sc-primary"
                          >
                            {coach.fullName}
                          </Link>
                          <b className="whitespace-nowrap tabular-nums">{formatCount(students)} HV</b>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-sc-paper-2">
                          <div className="h-full rounded-full bg-sc-primary" style={{ width: `${pct}%` }} />
                        </div>
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
        <SectionTitle>Chi tiết theo lớp học</SectionTitle>
        <Table<ClassRow>
          rowKey="classId"
          size="middle"
          columns={columns}
          dataSource={classes}
          loading={report.isFetching && !data}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{ emptyText: <EmptyState title="Chưa có lớp học nào trong kỳ báo cáo" /> }}
        />
      </Card>
    </div>
  );
}
