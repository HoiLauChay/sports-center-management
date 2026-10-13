import type { ClassSummary } from '@sports-center/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button, Card, Popconfirm, Segmented, Select, Space, Table, Tag, Tooltip, type TableColumnsType } from 'antd';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { SearchInput } from '~/components/form/SearchInput';
import { PageHeader } from '~/components/ui/PageHeader';
import { sportsQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useApproveClassFromList, useManagerClasses, useRejectClassFromList } from '../hooks/useClassAdmin';
import type { ManagerClassesQuery } from '../services/classes.service';
import { classDateRange, weeklyLines } from '../utils';
import { ClassCreateModal } from './ClassCreateModal';
import { ClassStatusTag } from './ClassTableParts';

type Phase = 'ALL' | 'PENDING' | 'OPEN' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';

const PHASE_QUERY: Record<Phase, Pick<ManagerClassesQuery, 'status' | 'derivedStatus'>> = {
  ALL: {},
  PENDING: { status: 'PENDING_APPROVAL' },
  OPEN: { status: 'OPEN', derivedStatus: 'UPCOMING' },
  ONGOING: { status: 'OPEN', derivedStatus: 'ONGOING' },
  COMPLETED: { status: 'OPEN', derivedStatus: 'COMPLETED' },
  CANCELLED: { status: 'CANCELLED' },
};

/** `/admin/classes` (UC_2.12, UC_2.15): every class by phase; pending ones are approved or rejected from the list. */
export function ClassesAdminPage() {
  const [phase, setPhase] = useState<Phase>('ALL');
  const [q, setQ] = useState('');
  const [sportId, setSportId] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);

  const sports = useQuery(sportsQueryOptions);
  const classes = useManagerClasses({
    page,
    limit: pageSize,
    ...PHASE_QUERY[phase],
    sportId: sportId || undefined,
    q: q.trim() || undefined,
  });
  const pending = useManagerClasses({ page: 1, limit: 1, ...PHASE_QUERY.PENDING });
  const approve = useApproveClassFromList();
  const reject = useRejectClassFromList();

  const columns: TableColumnsType<ClassSummary> = [
    {
      title: '#',
      key: 'index',
      width: 56,
      render: (_, __, index) => (
        <span className="font-display text-xl font-extrabold text-sc-muted-2">
          {String((page - 1) * pageSize + index + 1).padStart(2, '0')}
        </span>
      ),
    },
    {
      title: 'Tên lớp',
      width: 220,
      render: (_, record) => (
        <div>
          <Link
            to="/admin/classes/$classId"
            params={{ classId: record.id }}
            className="font-semibold text-sc-ink hover:text-sc-primary"
          >
            {record.name}
          </Link>
          <div className="text-xs text-sc-muted">
            {record.course.name} · {formatVND(record.course.price)}
          </div>
        </div>
      ),
    },
    { title: 'Bộ môn', render: (_, record) => <Tag color="green">{record.course.sport.name}</Tag> },
    { title: 'Phòng / sân', render: (_, record) => record.facility.name },
    {
      title: 'HLV',
      render: (_, record) =>
        record.coach ? (
          <span className="whitespace-nowrap">{record.coach.fullName}</span>
        ) : (
          <span className="whitespace-nowrap text-orange-500">Chưa có HLV</span>
        ),
    },
    {
      title: 'Sĩ số',
      render: (_, record) => (
        <div className="leading-tight">
          <div className="font-semibold">
            {record.enrolledCount}/{record.maxStudents}
          </div>
          <div className="text-xs text-sc-muted">tối thiểu {record.minStudents}</div>
        </div>
      ),
    },
    {
      title: 'Lịch',
      render: (_, record) => (
        <div className="whitespace-nowrap text-xs">
          {weeklyLines(record.weeklySchedule).map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      ),
    },
    {
      title: 'Thời gian',
      render: (_, record) => <span className="whitespace-nowrap text-xs">{classDateRange(record)}</span>,
    },
    { title: 'Trạng thái', render: (_, record) => <ClassStatusTag item={record} /> },
    {
      key: 'actions',
      align: 'right',
      width: 190,
      render: (_, record) =>
        record.status === 'PENDING_APPROVAL' ? (
          <Space size={4}>
            <Tooltip title={record.coach ? undefined : 'Lớp chưa có HLV, phân công trong chi tiết lớp trước'}>
              <Button
                size="small"
                type="primary"
                disabled={!record.coach}
                loading={approve.isPending && approve.variables === record.id}
                onClick={() => approve.mutate(record.id)}
              >
                Duyệt mở
              </Button>
            </Tooltip>
            <Popconfirm
              title="Từ chối, lớp về trạng thái nháp?"
              okText="Từ chối"
              cancelText="Không"
              onConfirm={() => reject.mutate(record.id)}
            >
              <Button size="small" loading={reject.isPending && reject.variables === record.id}>
                Từ chối
              </Button>
            </Popconfirm>
          </Space>
        ) : (
          <Link to="/admin/classes/$classId" params={{ classId: record.id }}>
            <Button size="small">Chi tiết</Button>
          </Link>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Lớp học"
        description="Các lớp mở từ khóa học. Lớp cần có HLV và được duyệt mới nhận đăng ký."
        extra={
          <Button type="primary" icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
            Tạo lớp
          </Button>
        }
      />

      <Segmented<Phase>
        className="!mb-4 max-w-full overflow-x-auto"
        value={phase}
        onChange={(value) => {
          setPhase(value);
          setPage(1);
        }}
        options={[
          { value: 'ALL', label: 'Tất cả' },
          { value: 'PENDING', label: `Chờ duyệt (${pending.data?.total ?? 0})` },
          { value: 'OPEN', label: 'Đang mở' },
          { value: 'ONGOING', label: 'Đang học' },
          { value: 'COMPLETED', label: 'Kết thúc' },
          { value: 'CANCELLED', label: 'Đã hủy' },
        ]}
      />

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchInput
            placeholder="Tìm theo tên lớp, HLV..."
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

        {classes.isError ? (
          <ErrorState message={toApiError(classes.error).message} onRetry={() => void classes.refetch()} />
        ) : (
          <Table<ClassSummary>
            rowKey="id"
            columns={columns}
            dataSource={classes.data?.items}
            loading={classes.isFetching}
            scroll={{ x: 'max-content' }}
            pagination={{
              current: page,
              pageSize,
              total: classes.data?.total ?? 0,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              showTotal: (total) => `${total} lớp học`,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
            locale={{
              emptyText: (
                <EmptyState
                  title={q || sportId || phase !== 'ALL' ? 'Không tìm thấy lớp học phù hợp' : 'Không có lớp nào'}
                  description={
                    q || sportId || phase !== 'ALL'
                      ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm'
                      : "Bấm 'Tạo lớp' để mở lớp cho một khóa học."
                  }
                />
              ),
            }}
          />
        )}
      </Card>

      <ClassCreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
