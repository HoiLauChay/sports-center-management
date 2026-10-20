import type { MyEnrollment } from '@sports-center/shared';
import { Link } from '@tanstack/react-router';
import { Button, Card, Segmented, Table, Tag, type TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { DateRangeFilter, type DateRange } from '~/components/form/DateRangeFilter';
import { PageHeader } from '~/components/ui/PageHeader';
import { canCancelEnrollment } from '~/features/checkout/refundPolicy';
import { formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { vnDate } from '~/lib/time';
import { useMyEnrollments } from '../hooks/useClasses';
import { classDateRange, weeklyText } from '../utils';
import { enrollmentProgress, useAskCancelEnrollment } from './enrollmentActions';

const STATUS_TAG: Record<MyEnrollment['status'], { label: string; color?: string }> = {
  ENROLLED: { label: 'Đang học', color: 'success' },
  CANCELLED: { label: 'Đã hủy' },
};

/** `/enrollments`: classes I enrolled in; before the class starts one can leave it and get the line refunded. */
export function EnrollmentsPage() {
  const enrollments = useMyEnrollments();
  const { ask: askCancel, cancel } = useAskCancelEnrollment();
  const [status, setStatus] = useState<MyEnrollment['status'] | 'ALL'>('ALL');
  const [range, setRange] = useState<DateRange>({});

  // `GET /me/enrollments` has no filters, so the list is narrowed here by status and registration date.
  const rows = useMemo(
    () =>
      (enrollments.data ?? []).filter((enrollment) => {
        if (status !== 'ALL' && enrollment.status !== status) return false;
        const enrolledOn = vnDate(enrollment.enrolledAt);
        if (range.from && enrolledOn < range.from) return false;
        if (range.to && enrolledOn > range.to) return false;
        return true;
      }),
    [enrollments.data, status, range],
  );
  const filtered = status !== 'ALL' || Boolean(range.from || range.to);

  const columns: TableColumnsType<MyEnrollment> = [
    {
      title: 'Lớp',
      key: 'class',
      render: (_, enrollment) => (
        <div className="flex flex-col gap-0.5 md:min-w-48">
          <Link to="/classes/$classId" params={{ classId: enrollment.class.id }} className="font-semibold">
            {enrollment.class.name}
          </Link>
          <span className="text-[13px] text-sc-muted">
            {enrollment.class.course.sport.name} · HLV {enrollment.class.coach?.fullName ?? '—'}
          </span>
          <span className="text-[13px] text-sc-muted md:hidden">
            {weeklyText(enrollment.class.weeklySchedule)} · {classDateRange(enrollment.class)}
          </span>
          {enrollment.status === 'ENROLLED' && (
            <span className="text-[13px] font-semibold text-sc-primary">{enrollmentProgress(enrollment)}</span>
          )}
        </div>
      ),
    },
    {
      title: 'Lịch học',
      key: 'schedule',
      responsive: ['md'],
      render: (_, enrollment) => (
        <div className="flex flex-col gap-0.5">
          <span className="whitespace-nowrap">{weeklyText(enrollment.class.weeklySchedule)}</span>
          <span className="text-[13px] text-sc-muted tabular-nums">
            {enrollment.class.course.totalSessions} buổi · {classDateRange(enrollment.class)}
          </span>
        </div>
      ),
    },
    {
      title: 'Đã trả',
      dataIndex: 'paidAmount',
      align: 'right',
      responsive: ['md'],
      render: (value: number) => <span className="whitespace-nowrap tabular-nums">{formatVND(value)}</span>,
    },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_, enrollment) => (
        <div className="flex flex-col items-start gap-0.5">
          <Tag color={STATUS_TAG[enrollment.status].color} className="!m-0">
            {STATUS_TAG[enrollment.status].label}
          </Tag>
          {enrollment.refundedAt && (
            <span className="text-[13px] text-sc-error">Đã hoàn {formatVND(enrollment.paidAmount)}</span>
          )}
        </div>
      ),
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, enrollment) =>
        enrollment.status === 'ENROLLED' && canCancelEnrollment(enrollment.class.startDate) ? (
          <Button
            size="small"
            danger
            loading={cancel.isPending && cancel.variables === enrollment.id}
            onClick={() => askCancel(enrollment)}
          >
            Hủy đăng ký
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader title="Lớp đã đăng ký" />
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: 'ALL', label: 'Tất cả' },
              { value: 'ENROLLED', label: STATUS_TAG.ENROLLED.label },
              { value: 'CANCELLED', label: STATUS_TAG.CANCELLED.label },
            ]}
          />
          <DateRangeFilter value={range} onChange={setRange} />
        </div>
        {enrollments.isError && !enrollments.data ? (
          <ErrorState message={toApiError(enrollments.error).message} onRetry={() => void enrollments.refetch()} />
        ) : (
          <Table<MyEnrollment>
            rowKey="id"
            columns={columns}
            dataSource={rows}
            loading={enrollments.isFetching}
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            locale={{
              emptyText: enrollments.isFetching ? (
                ' '
              ) : filtered ? (
                <EmptyState title="Không có lớp nào khớp bộ lọc" />
              ) : (
                <EmptyState
                  title="Bạn chưa đăng ký lớp nào"
                  action={
                    <Link to="/classes">
                      <Button type="primary">Xem lớp đang mở</Button>
                    </Link>
                  }
                />
              ),
            }}
          />
        )}
      </Card>
    </>
  );
}
