import { PAGINATION, type ClassSummary, type Course } from '@sports-center/shared';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Popconfirm, Select, Space, Table, Tag, type TableColumnsType } from 'antd';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { SearchInput } from '~/components/form/SearchInput';
import { PageHeader } from '~/components/ui/PageHeader';
import { sportsQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { useManagerClasses } from '~/features/classes/hooks/useClassAdmin';
import { formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useCourses, useDeleteCourse } from '../hooks/useCourses';
import { CourseFormModal } from './CourseFormModal';

/** `/admin/courses` (UC_2.11, BR_2.8): course templates (sport, sessions, fee); each course opens many classes. */
export function CoursesPage() {
  const courses = useCourses();
  const sports = useQuery(sportsQueryOptions);
  const classes = useManagerClasses({ page: 1, limit: PAGINATION.MAX_LIMIT });
  const deleteMutation = useDeleteCourse();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [q, setQ] = useState('');
  const [sportId, setSportId] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const classesOf = useMemo(() => {
    const map = new Map<string, ClassSummary[]>();
    for (const item of classes.data?.items ?? []) {
      if (item.status === 'CANCELLED') continue;
      map.set(item.course.id, [...(map.get(item.course.id) ?? []), item]);
    }
    return map;
  }, [classes.data]);

  const filteredCourses = useMemo(() => {
    if (!courses.data) return [];
    const search = q.trim().toLowerCase();
    return courses.data.filter((course) => {
      if (sportId && course.sport.id !== sportId) return false;
      if (search) {
        const matchName = course.name.toLowerCase().includes(search);
        const matchDesc = course.description?.toLowerCase().includes(search);
        const matchSport = course.sport.name.toLowerCase().includes(search);
        if (!matchName && !matchDesc && !matchSport) return false;
      }
      return true;
    });
  }, [courses.data, sportId, q]);

  const openModal = (course: Course | null) => {
    setEditing(course);
    setModalOpen(true);
  };

  const columns: TableColumnsType<Course> = [
    {
      title: '#',
      key: 'index',
      width: 50,
      render: (_, __, index) => (
        <span className="font-display text-xl font-extrabold text-sc-muted-2">
          {String((page - 1) * pageSize + index + 1).padStart(2, '0')}
        </span>
      ),
    },
    {
      title: 'Khóa học',
      key: 'name',
      render: (_, record) => (
        <div className="min-w-[140px] max-w-sm">
          <div className="font-semibold text-sc-ink">{record.name}</div>
          {record.description && <div className="line-clamp-2 text-xs text-sc-muted">{record.description}</div>}
        </div>
      ),
    },
    {
      title: 'Bộ môn',
      key: 'sport',
      width: 110,
      render: (_, record) => (
        <Tag color="green" className="!m-0">
          {record.sport.name}
        </Tag>
      ),
    },
    {
      title: 'Số buổi',
      dataIndex: 'totalSessions',
      key: 'totalSessions',
      width: 85,
      align: 'center',
    },
    {
      title: 'Học phí',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      align: 'right',
      render: (price: number) => <span className="whitespace-nowrap font-semibold">{formatVND(price)}</span>,
    },
    {
      title: 'Lớp',
      key: 'classes',
      width: 220,
      render: (_, record) => {
        const list = classesOf.get(record.id) ?? [];
        if (!list.length) return <span className="text-sc-muted">—</span>;
        return (
          <Space wrap size={[4, 4]} className="max-w-[220px]">
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
      title: 'Thao tác',
      key: 'actions',
      width: 115,
      align: 'right',
      render: (_, record) => {
        return (
          <Space size="small">
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
              <Button size="small" danger>
                Xóa
              </Button>
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
        extra={
          <Button type="primary" icon={<Plus size={16} />} onClick={() => openModal(null)}>
            Tạo khóa học
          </Button>
        }
      />

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchInput
            placeholder="Tìm theo tên khóa học, mô tả..."
            value={q}
            onChange={(val) => {
              setQ(val);
              setPage(1);
            }}
            className="w-full sm:!w-72"
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Tất cả bộ môn"
            value={sportId}
            onChange={(val) => {
              setSportId(val);
              setPage(1);
            }}
            className="w-full sm:!w-52"
            options={(sports.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
          />
        </div>

        {courses.isError ? (
          <ErrorState message={toApiError(courses.error).message} onRetry={() => void courses.refetch()} />
        ) : (
          <Table<Course>
            rowKey="id"
            columns={columns}
            dataSource={filteredCourses}
            loading={courses.isPending}
            scroll={{ x: 860 }}
            pagination={{
              current: page,
              pageSize,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              showTotal: (total) => `${total} khóa học`,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
            locale={{
              emptyText: (
                <EmptyState
                  title={q || sportId ? 'Không tìm thấy khóa học phù hợp' : 'Chưa có khóa học nào'}
                  description={
                    q || sportId
                      ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm'
                      : "Bấm 'Tạo khóa học' để thêm khóa học đầu tiên."
                  }
                />
              ),
            }}
          />
        )}
      </Card>

      <CourseFormModal open={modalOpen} editing={editing} onClose={() => setModalOpen(false)} />
    </>
  );
}
