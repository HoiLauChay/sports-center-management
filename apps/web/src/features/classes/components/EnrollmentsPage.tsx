import { Link } from '@tanstack/react-router';
import { Button, Card, Table, Tag, type TableColumnsType } from 'antd';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { canCancelEnrollment, enrollmentRefund } from '~/features/checkout/refundPolicy';
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

/** `/enrollments`: classes I enrolled in; before the class starts one can leave it and get the line refunded. */
export function EnrollmentsPage() {
  const confirm = useConfirm();
  const enrollments = useMyEnrollments();
  const cancel = useCancelEnrollment();

  const askCancel = (enrollment: MyEnrollment) => {
    const refund = enrollmentRefund(enrollment);
    confirm({
      title: `Hủy đăng ký lớp ${enrollment.class.name}?`,
      content: (
        <div className="flex flex-col gap-2">
          <span>Khai giảng {formatDate(enrollment.class.startDate!)}.</span>
          <b className="text-sc-success">
            {refund > 0
              ? `Bạn sẽ được hoàn ${formatVND(refund)} về ví.`
              : 'Lớp này không có khoản thanh toán nên không có tiền hoàn.'}
          </b>
        </div>
      ),
      okText: refund > 0 ? `Hủy và nhận ${formatVND(refund)}` : 'Hủy đăng ký',
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
      <PageHeader
        title="Lớp đã đăng ký"
        description="Danh sách lớp bạn đã mua. Có thể hủy trước ngày khai giảng và được hoàn toàn bộ học phí về ví."
      />
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
