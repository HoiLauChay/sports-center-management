import { Link } from '@tanstack/react-router';
import { Button, Card, Table, Tag, type TableColumnsType } from 'antd';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { describeRefund, enrollmentRefund } from '~/features/checkout/refundPolicy';
import { useSettings } from '~/features/settings';
import { useConfirm } from '~/hooks/useConfirm';
import { formatDate, formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useCancelEnrollment, useMyEnrollments } from '../hooks/useClasses';
import type { MyEnrollment } from '../types';
import { weeklyText } from '../utils';

const STATUS_TAG: Record<MyEnrollment['status'], { label: string; color?: string }> = {
  ENROLLED: { label: 'Đang học', color: 'success' },
  CANCELLED: { label: 'Đã hủy' },
};

/** `/enrollments`: classes I enrolled in, with cancel and a confirmation that states the refund. */
export function EnrollmentsPage() {
  const settings = useSettings();
  const confirm = useConfirm();
  const enrollments = useMyEnrollments();
  const cancel = useCancelEnrollment();

  const askCancel = (enrollment: MyEnrollment) => {
    if (!settings.data) return;
    const refund = enrollmentRefund(enrollment, enrollment.class.startDate, settings.data);
    confirm({
      title: `Hủy đăng ký lớp ${enrollment.class.name}?`,
      content: (
        <div className="flex flex-col gap-2">
          <span>
            {enrollment.class.startDate
              ? `Buổi học đầu tiên: ${formatDate(enrollment.class.startDate)}.`
              : 'Lớp chưa có lịch học.'}
          </span>
          <b className={refund.amount > 0 ? 'text-sc-success' : 'text-sc-error'}>
            {describeRefund(refund, settings.data, 'enrollment')}
          </b>
        </div>
      ),
      okText: refund.amount > 0 ? `Hủy và nhận ${formatVND(refund.amount)}` : 'Vẫn hủy, không hoàn tiền',
      onOk: () => cancel.mutateAsync(enrollment.id).catch(() => undefined),
    });
  };

  const columns: TableColumnsType<MyEnrollment> = [
    {
      title: 'Lớp',
      key: 'class',
      render: (_, enrollment) => (
        <div className="flex min-w-48 flex-col gap-0.5">
          <Link to="/classes/$classId" params={{ classId: enrollment.class.id }} className="font-semibold">
            {enrollment.class.name}
          </Link>
          <span className="text-[13px] text-sc-muted">
            {enrollment.class.course.sport.name} · HLV {enrollment.class.coach?.fullName ?? '—'}
          </span>
        </div>
      ),
    },
    {
      title: 'Lịch học',
      key: 'schedule',
      render: (_, enrollment) => (
        <div className="flex flex-col gap-0.5">
          <span className="whitespace-nowrap">{weeklyText(enrollment.class.weeklySchedule)}</span>
          {enrollment.class.startDate && (
            <span className="text-[13px] text-sc-muted">Khai giảng {formatDate(enrollment.class.startDate)}</span>
          )}
        </div>
      ),
    },
    {
      title: 'Đã trả',
      dataIndex: 'paidAmount',
      align: 'right',
      render: (value: number) => <b className="whitespace-nowrap tabular-nums">{formatVND(value)}</b>,
    },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_, enrollment) => (
        <div className="flex flex-col items-start gap-0.5">
          <Tag color={STATUS_TAG[enrollment.status].color} className="!m-0">
            {STATUS_TAG[enrollment.status].label}
          </Tag>
          {enrollment.refundedAmount > 0 && (
            <span className="text-xs text-sc-error">Đã hoàn {formatVND(enrollment.refundedAmount)}</span>
          )}
        </div>
      ),
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, enrollment) =>
        enrollment.status === 'ENROLLED' ? (
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
      <PageHeader title="Lớp đã đăng ký" description="Danh sách lớp bạn đã mua. Hủy trước hạn được hoàn tiền về ví." />
      <Card>
        {enrollments.isError && !enrollments.data ? (
          <ErrorState message={toApiError(enrollments.error).message} onRetry={() => void enrollments.refetch()} />
        ) : (
          <Table<MyEnrollment>
            rowKey="id"
            columns={columns}
            dataSource={enrollments.data}
            loading={enrollments.isFetching}
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            locale={{
              emptyText: enrollments.isFetching ? (
                ' '
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
