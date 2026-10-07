import type { Course } from '@sports-center/shared';
import { Button, Card, Popconfirm, Space, Table, Tag, Tooltip, type TableColumnsType } from 'antd';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { useManagerClasses } from '~/features/classes/hooks/useClassAdmin';
import type { GymClass } from '~/features/classes/types';
import { formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useCourses, useDeleteCourse } from '../hooks/useCourses';
import { CourseFormModal } from './CourseFormModal';

/** `/admin/courses` (UC_2.11, BR_2.8): course templates (sport, sessions, fee); each course opens many classes. */
export function CoursesPage() {
  const courses = useCourses();
  const classes = useManagerClasses();
  const deleteMutation = useDeleteCourse();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);

  /** Live classes of each course, shown next to it; an OPEN one blocks deleting the course. */
  const classesOf = useMemo(() => {
    const map = new Map<string, GymClass[]>();
    for (const item of classes.data ?? []) {
      if (item.status === 'CANCELLED') continue;
      map.set(item.course.id, [...(map.get(item.course.id) ?? []), item]);
    }
    return map;
  }, [classes.data]);

  const openModal = (course: Course | null) => {
    setEditing(course);
    setModalOpen(true);
  };

  const columns: TableColumnsType<Course> = [
    {
      title: 'Khóa học',
      render: (_, record) => (
        <div className="max-w-md">
          <div className="font-semibold text-sc-ink">{record.name}</div>
          {record.description && <div className="line-clamp-2 text-xs text-sc-muted">{record.description}</div>}
        </div>
      ),
    },
    { title: 'Bộ môn', render: (_, record) => <Tag color="green">{record.sport.name}</Tag> },
    { title: 'Số buổi', dataIndex: 'totalSessions', align: 'center' },
    {
      title: 'Học phí',
      dataIndex: 'price',
      align: 'right',
      render: (price: number) => <span className="whitespace-nowrap font-semibold">{formatVND(price)}</span>,
    },
    {
      title: 'Lớp',
      render: (_, record) => {
        const list = classesOf.get(record.id) ?? [];
        if (!list.length) return <span className="text-sc-muted">—</span>;
        return (
          <Space wrap size={[4, 4]} className="max-w-xs">
            {list.map((item) => (
              <Tag key={item.id} className="!m-0">
                {item.name}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      key: 'actions',
      align: 'right',
      render: (_, record) => {
        const hasOpenClass = (classesOf.get(record.id) ?? []).some((item) => item.status === 'OPEN');
        return (
          <Space>
            <Button size="small" onClick={() => openModal(record)}>
              Sửa
            </Button>
            <Popconfirm
              title="Xóa khóa học?"
              description="Lớp đã tạo và hóa đơn vẫn tham chiếu được khóa học này."
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
              onConfirm={() => deleteMutation.mutate(record.id)}
            >
              <Tooltip title={hasOpenClass ? 'Khóa học còn lớp đang mở' : undefined}>
                <Button size="small" danger disabled={hasOpenClass}>
                  Xóa
                </Button>
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Khóa học"
        description="Template khóa học: bộ môn, số buổi, học phí. Mỗi khóa mở được nhiều lớp."
        extra={
          <Button type="primary" icon={<Plus size={16} />} onClick={() => openModal(null)}>
            Tạo khóa học
          </Button>
        }
      />

      <Card styles={{ body: { padding: 0 } }}>
        {courses.isError ? (
          <ErrorState message={toApiError(courses.error).message} onRetry={() => void courses.refetch()} />
        ) : (
          <Table<Course>
            rowKey="id"
            columns={columns}
            dataSource={courses.data}
            loading={courses.isPending}
            scroll={{ x: 900 }}
            pagination={{ pageSize: 10, showSizeChanger: false, hideOnSinglePage: true }}
            locale={{
              emptyText: (
                <EmptyState title="Chưa có khóa học nào" description="Bấm 'Tạo khóa học' để thêm khóa học đầu tiên." />
              ),
            }}
          />
        )}
      </Card>

      <CourseFormModal open={modalOpen} editing={editing} onClose={() => setModalOpen(false)} />
    </>
  );
}
