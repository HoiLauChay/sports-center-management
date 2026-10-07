import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button, Card, Input, Select, Table, Tag, type TableColumnsType } from 'antd';
import { ExternalLink, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { sportsQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { formatDate } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { classAdminService } from '../services/classAdmin.service';
import type { ClassStatus, GymClass } from '../types';
import { weeklyText } from '../utils';
import { ClassCreateModal } from './ClassCreateModal';

const STATUS_LABELS: Record<ClassStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Bản nháp', color: 'default' },
  PENDING_APPROVAL: { label: 'Chờ duyệt', color: 'warning' },
  OPEN: { label: 'Đang mở', color: 'success' },
  CANCELLED: { label: 'Đã hủy', color: 'error' },
};

export function ClassesAdminPage() {
  const sports = useQuery(sportsQueryOptions);
  const classesQuery = useQuery({
    queryKey: ['classes', 'admin-list'],
    queryFn: () => classAdminService.listAll(),
  });

  const [q, setQ] = useState('');
  const [sportId, setSportId] = useState<string | undefined>();
  const [status, setStatus] = useState<ClassStatus | undefined>();
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const list = classesQuery.data ?? [];
    const term = q.trim().toLowerCase();
    return list
      .filter((c) => !sportId || c.course.sport.id === sportId)
      .filter((c) => !status || c.status === status)
      .filter(
        (c) => !term || c.name.toLowerCase().includes(term) || (c.coach?.fullName ?? '').toLowerCase().includes(term),
      );
  }, [classesQuery.data, sportId, status, q]);

  const columns: TableColumnsType<GymClass> = [
    {
      title: 'Tên lớp học',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <div>
          <Link
            to="/admin/classes/$classId"
            params={{ classId: record.id }}
            className="font-semibold text-sc-ink hover:text-sc-primary"
          >
            {name}
          </Link>
          <div className="text-xs text-sc-muted">{record.course.name}</div>
        </div>
      ),
    },
    {
      title: 'Bộ môn',
      dataIndex: ['course', 'sport', 'name'],
      key: 'sport',
      width: 120,
      render: (sportName: string) => <Tag color="blue">{sportName}</Tag>,
    },
    {
      title: 'Cơ sở',
      dataIndex: ['facility', 'name'],
      key: 'facility',
      width: 150,
    },
    {
      title: 'Huấn luyện viên',
      dataIndex: 'coach',
      key: 'coach',
      width: 150,
      render: (coach: GymClass['coach']) => coach?.fullName ?? <span className="text-sc-muted">Chưa gán</span>,
    },
    {
      title: 'Lịch học',
      dataIndex: 'weeklySchedule',
      key: 'weeklySchedule',
      width: 170,
      render: (schedule: GymClass['weeklySchedule']) => weeklyText(schedule),
    },
    {
      title: 'Thời gian',
      key: 'dates',
      width: 180,
      render: (_, record) =>
        record.startDate && record.endDate ? (
          <span className="text-xs">
            {formatDate(record.startDate)} – {formatDate(record.endDate)}
          </span>
        ) : (
          <span className="text-xs text-sc-muted">—</span>
        ),
    },
    {
      title: 'Sĩ số',
      key: 'students',
      width: 100,
      align: 'center',
      render: (_, record) => `${record.enrolledCount}/${record.maxStudents}`,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      align: 'center',
      render: (st: ClassStatus) => {
        const meta = STATUS_LABELS[st] ?? { label: st, color: 'default' };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Link to="/admin/classes/$classId" params={{ classId: record.id }}>
          <Button size="small" icon={<ExternalLink size={14} />}>
            Chi tiết
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Lớp học (Quản lý)"
        description="Quản lý việc tạo lớp, phân công HLV, duyệt mở lớp và lịch học chi tiết."
        extra={
          <Button type="primary" icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
            Tạo lớp học
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Input.Search
          allowClear
          placeholder="Tìm tên lớp, HLV..."
          className="w-full sm:!w-72"
          onSearch={(val) => setQ(val.trim())}
          onChange={(e) => !e.target.value && setQ('')}
        />
        <Select
          allowClear
          placeholder="Mọi bộ môn"
          className="w-full sm:!w-48"
          loading={sports.isPending}
          value={sportId}
          onChange={(val) => setSportId(val)}
          options={(sports.data ?? []).filter((s) => s.isActive).map((s) => ({ value: s.id, label: s.name }))}
        />
        <Select
          allowClear
          placeholder="Mọi trạng thái"
          className="w-full sm:!w-44"
          value={status}
          onChange={(val) => setStatus(val)}
          options={[
            { value: 'DRAFT', label: 'Bản nháp' },
            { value: 'PENDING_APPROVAL', label: 'Chờ duyệt' },
            { value: 'OPEN', label: 'Đang mở' },
            { value: 'CANCELLED', label: 'Đã hủy' },
          ]}
        />
      </div>

      {classesQuery.isError ? (
        <Card>
          <ErrorState message={toApiError(classesQuery.error).message} onRetry={() => void classesQuery.refetch()} />
        </Card>
      ) : (
        <Card styles={{ body: { padding: 0 } }}>
          <Table<GymClass>
            rowKey="id"
            columns={columns}
            dataSource={filtered}
            loading={classesQuery.isPending}
            pagination={{
              pageSize: 10,
              showSizeChanger: false,
              hideOnSinglePage: true,
            }}
            locale={{
              emptyText: (
                <EmptyState title="Chưa có lớp học nào" description="Bấm 'Tạo lớp học' để bắt đầu mở lớp mới." />
              ),
            }}
          />
        </Card>
      )}

      <ClassCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => void classesQuery.refetch()}
      />
    </>
  );
}
