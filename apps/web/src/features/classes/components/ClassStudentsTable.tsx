import type { Enrollment } from '@sports-center/shared';
import { Table, Tag, type TableColumnsType } from 'antd';
import { ErrorState } from '~/components/feedback/States';
import { formatDate, formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useClassEnrollments } from '../hooks/useClasses';

interface ClassStudentsTableProps {
  classId: string;
  /** Show what each student paid and whether it was refunded (manager, receptionist). */
  showPayment?: boolean;
  className?: string;
}

/** `GET /classes/{id}/enrollments`: a coach gets the students still enrolled, staff also see cancelled ones. */
export function ClassStudentsTable({ classId, showPayment = false, className }: ClassStudentsTableProps) {
  const enrollments = useClassEnrollments(classId);

  if (enrollments.isError) {
    return <ErrorState message={toApiError(enrollments.error).message} onRetry={() => void enrollments.refetch()} />;
  }

  const columns: TableColumnsType<Enrollment> = [
    {
      title: '#',
      key: 'index',
      width: 56,
      render: (_, __, index) => (
        <span className="font-display text-xl font-extrabold text-sc-muted-2">
          {String(index + 1).padStart(2, '0')}
        </span>
      ),
    },
    {
      title: 'Học viên',
      render: (_, record) => <span className="font-semibold text-sc-ink">{record.account.fullName}</span>,
    },
    { title: 'Ngày đăng ký', render: (_, record) => formatDate(record.enrolledAt) },
    {
      title: 'Trạng thái',
      render: (_, record) =>
        record.status === 'ENROLLED' ? <Tag color="success">Đang học</Tag> : <Tag color="error">Đã hủy</Tag>,
    },
  ];
  if (showPayment) {
    columns.push({
      title: 'Học phí',
      align: 'right',
      render: (_, record) => (
        <span className="whitespace-nowrap tabular-nums">
          {formatVND(record.paidAmount)}
          {record.refundedAt && <Tag className="!ml-2">Đã hoàn</Tag>}
        </span>
      ),
    });
  }

  return (
    <Table<Enrollment>
      rowKey="id"
      columns={columns}
      dataSource={enrollments.data}
      loading={enrollments.isPending}
      pagination={{ pageSize: 10, hideOnSinglePage: true }}
      scroll={{ x: 'max-content' }}
      className={className}
      locale={{ emptyText: 'Lớp chưa có học viên' }}
    />
  );
}
