import { useQuery } from '@tanstack/react-query';
import { Input, Modal, Table, Tag, type TableColumnsType } from 'antd';
import { Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState, PageLoading } from '~/components/feedback/States';
import { formatDate } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { coachClassesService } from '../services/coachClasses.service';
import type { ClassStudent, GymClass } from '../types';

interface CoachClassStudentsModalProps {
  open: boolean;
  onClose: () => void;
  gymClass: GymClass | null;
}

export function CoachClassStudentsModal({ open, onClose, gymClass }: CoachClassStudentsModalProps) {
  const [q, setQ] = useState('');

  const studentsQuery = useQuery({
    queryKey: ['coach', 'class-students', gymClass?.id],
    queryFn: () => coachClassesService.getClassStudents(gymClass!.id),
    enabled: open && Boolean(gymClass?.id),
  });

  const filteredStudents = useMemo(() => {
    const list = studentsQuery.data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter((s) => s.fullName.toLowerCase().includes(term));
  }, [studentsQuery.data, q]);

  const enrolledCount = useMemo(
    () => (studentsQuery.data ?? []).filter((s) => s.status === 'ENROLLED').length,
    [studentsQuery.data],
  );

  const columns: TableColumnsType<ClassStudent> = [
    {
      title: '#',
      key: 'index',
      width: 60,
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Họ và tên học viên',
      dataIndex: 'fullName',
      key: 'fullName',
      render: (name: string) => <span className="font-medium text-sc-ink">{name}</span>,
    },
    {
      title: 'Ngày đăng ký',
      dataIndex: 'enrolledAt',
      key: 'enrolledAt',
      render: (date: string | null) =>
        date ? formatDate(date) : <span className="text-xs text-sc-muted">Trước khai giảng</span>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: 'ENROLLED' | 'CANCELLED') =>
        status === 'ENROLLED' ? <Tag color="success">Đã tham gia</Tag> : <Tag color="error">Đã hủy</Tag>,
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      title={
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-sc-primary" />
          <span>Danh sách học viên · {gymClass?.name}</span>
        </div>
      }
    >
      <div className="space-y-4 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-sc-bg p-3 border border-sc-line">
          <div>
            <div className="text-xs text-sc-muted">Khóa học & Bộ môn</div>
            <div className="text-sm font-semibold text-sc-ink">
              {gymClass?.course.name} · {gymClass?.course.sport.name}
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-sc-muted">Đã đăng ký: </span>
              <span className="font-bold text-sc-primary">{enrolledCount}</span>
              <span className="text-sc-muted"> / {gymClass?.maxStudents} học viên</span>
            </div>
            <div>
              <span className="text-sc-muted">Tối thiểu mở lớp: </span>
              <span className="font-medium">{gymClass?.minStudents}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Input
            prefix={<Search className="h-4 w-4 text-sc-muted" />}
            placeholder="Tìm theo tên học viên..."
            allowClear
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-xs"
          />
        </div>

        {studentsQuery.isLoading ? (
          <PageLoading />
        ) : studentsQuery.isError ? (
          <ErrorState message={toApiError(studentsQuery.error).message} onRetry={() => void studentsQuery.refetch()} />
        ) : filteredStudents.length === 0 ? (
          <EmptyState
            title={q ? 'Không tìm thấy học viên phù hợp' : 'Chưa có học viên đăng ký'}
            description={q ? 'Thử tìm với từ khóa khác' : 'Lớp học hiện tại chưa ghi nhận học viên nào tham gia.'}
          />
        ) : (
          <Table
            dataSource={filteredStudents}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 8, showTotal: (t) => `Tổng ${t} học viên` }}
            size="middle"
          />
        )}
      </div>
    </Modal>
  );
}
