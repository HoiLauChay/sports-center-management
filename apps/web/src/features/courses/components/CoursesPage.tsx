import type { Course } from '@sports-center/shared';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Input, Popconfirm, Select, Space, Table, Tag, type TableColumnsType } from 'antd';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { sportsQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useCourses, useDeleteCourse } from '../hooks/useCourses';
import { CourseFormModal } from './CourseFormModal';

export function CoursesPage() {
  const sports = useQuery(sportsQueryOptions);
  const courses = useCourses();
  const deleteMutation = useDeleteCourse();

  const [sportId, setSportId] = useState<string | undefined>();
  const [q, setQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);

  const filtered = useMemo(() => {
    const list = courses.data ?? [];
    const term = q.trim().toLowerCase();
    return list
      .filter((c) => !sportId || c.sport.id === sportId)
      .filter(
        (c) => !term || c.name.toLowerCase().includes(term) || (c.description ?? '').toLowerCase().includes(term),
      );
  }, [courses.data, sportId, q]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (course: Course) => {
    setEditing(course);
    setModalOpen(true);
  };

  const columns: TableColumnsType<Course> = [
    {
      title: 'Tên khóa học',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <div>
          <div className="font-semibold text-sc-ink">{name}</div>
          {record.description && <div className="line-clamp-1 text-xs text-sc-muted">{record.description}</div>}
        </div>
      ),
    },
    {
      title: 'Bộ môn',
      dataIndex: ['sport', 'name'],
      key: 'sport',
      width: 140,
      render: (sportName: string) => <Tag color="blue">{sportName}</Tag>,
    },
    {
      title: 'Số buổi',
      dataIndex: 'totalSessions',
      key: 'totalSessions',
      width: 100,
      align: 'center',
      render: (sessions: number) => <span className="font-medium">{sessions} buổi</span>,
    },
    {
      title: 'Học phí',
      dataIndex: 'price',
      key: 'price',
      width: 150,
      align: 'right',
      render: (price: number) => <span className="font-bold text-sc-primary">{formatVND(price)}</span>,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 130,
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Button type="text" size="small" icon={<Edit2 size={15} />} onClick={() => openEdit(record)} />
          <Popconfirm
            title="Xóa khóa học?"
            description={`Bạn có chắc muốn xóa "${record.name}"?`}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Button type="text" danger size="small" icon={<Trash2 size={15} />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Khóa học"
        description="Quản lý danh mục các khóa đào tạo, số buổi và học phí áp dụng cho lớp học."
        extra={
          <Button type="primary" icon={<Plus size={16} />} onClick={openCreate}>
            Tạo khóa học
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Input.Search
          allowClear
          placeholder="Tìm tên khóa học..."
          className="w-full sm:!w-72"
          onSearch={(v) => setQ(v.trim())}
          onChange={(e) => !e.target.value && setQ('')}
        />
        <Select
          allowClear
          placeholder="Mọi bộ môn"
          className="w-full sm:!w-56"
          loading={sports.isPending}
          value={sportId}
          onChange={(val: string | undefined) => setSportId(val)}
          options={(sports.data ?? []).filter((s) => s.isActive).map((s) => ({ value: s.id, label: s.name }))}
        />
      </div>

      {courses.isError ? (
        <Card>
          <ErrorState message={toApiError(courses.error).message} onRetry={() => void courses.refetch()} />
        </Card>
      ) : (
        <Card styles={{ body: { padding: 0 } }}>
          <Table<Course>
            rowKey="id"
            columns={columns}
            dataSource={filtered}
            loading={courses.isPending}
            pagination={{
              pageSize: 10,
              showSizeChanger: false,
              hideOnSinglePage: true,
            }}
            locale={{
              emptyText: (
                <EmptyState title="Chưa có khóa học nào" description="Bấm 'Tạo khóa học' để thêm khóa học đầu tiên." />
              ),
            }}
          />
        </Card>
      )}

      <CourseFormModal
        open={modalOpen}
        editing={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
      />
    </>
  );
}
