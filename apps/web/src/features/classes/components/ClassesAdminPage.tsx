import type { ClassSummary } from '@sports-center/shared';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { Button, Card, Segmented, Select, Table, Tag, type TableColumnsType } from 'antd';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { RowActions } from '~/components/data/RowActions';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { SearchInput } from '~/components/form/SearchInput';
import { PageHeader } from '~/components/ui/PageHeader';
import { SportTag } from '~/components/ui/SportTag';
import { sportsQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { useCourses } from '~/features/courses/hooks/useCourses';
import { useConfirm } from '~/hooks/useConfirm';
import { useRowLink } from '~/hooks/useRowLink';
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

const routeApi = getRouteApi('/_authenticated/_manager/admin/classes/');

/** `/admin/classes` (UC_2.12, UC_2.15): every class by phase; pending ones are approved or rejected from the list. */
export function ClassesAdminPage() {
  const [phase, setPhase] = useState<Phase>('ALL');
  const [q, setQ] = useState('');
  const [sportId, setSportId] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const confirm = useConfirm();
  const rowLink = useRowLink((record: ClassSummary) => ({
    to: '/admin/classes/$classId',
    params: { classId: record.id },
  }));
  const { courseId } = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const courses = useCourses();
  const course = courses.data?.find((item) => item.id === courseId);

  const sports = useQuery(sportsQueryOptions);
  const classes = useManagerClasses({
    page,
    limit: pageSize,
    ...PHASE_QUERY[phase],
    sportId: sportId || undefined,
    courseId,
    q: q.trim() || undefined,
  });
  const pending = useManagerClasses({ page: 1, limit: 1, ...PHASE_QUERY.PENDING, courseId });
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
      title: 'Lớp',
      dataIndex: 'name',
      render: (_, record) => (
        <div className="flex w-60 flex-col gap-1">
          <Link
            to="/admin/classes/$classId"
            params={{ classId: record.id }}
            className="font-semibold text-sc-ink hover:text-sc-primary"
          >
            {record.name}
          </Link>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14.5px] text-sc-muted">
            <SportTag name={record.course.sport.name} />
            <span>
              {record.course.name} · {formatVND(record.course.price)}
            </span>
          </div>
        </div>
      ),
    },
    {
      title: 'HLV',
      render: (_, record) =>
        record.coach ? (
          <span className="font-medium text-sc-ink">{record.coach.fullName}</span>
        ) : (
          <span className="text-[14.5px] font-medium text-orange-500">Chưa có HLV</span>
        ),
    },
    {
      title: 'Sĩ số',
      render: (_, record) => (
        <div className="leading-tight">
          <div className="text-sc-ink tabular-nums">
            {record.enrolledCount}/{record.maxStudents}
          </div>
          <div className="whitespace-nowrap text-[14.5px] text-sc-muted">tối thiểu {record.minStudents}</div>
        </div>
      ),
    },
    {
      title: 'Lịch · Phòng / sân',
      render: (_, record) => (
        <div className="flex flex-col gap-0.5 whitespace-nowrap">
          {weeklyLines(record.weeklySchedule).map((line) => (
            <span key={line}>{line}</span>
          ))}
          <span className="text-[14.5px] text-sc-muted">{classDateRange(record)}</span>
          <span className="text-[14.5px] text-sc-muted">{record.facility.name}</span>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      render: (_, record) => <ClassStatusTag item={record} />,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      hidden: phase !== 'PENDING',
      align: 'right',
      render: (_, record) => (
        <RowActions
          label={`Thao tác với lớp ${record.name}`}
          actions={
            record.status === 'PENDING_APPROVAL'
              ? [
                  {
                    key: 'approve',
                    label: 'Duyệt',
                    primary: true,
                    disabled: !record.coach,
                    hint: 'Lớp chưa có HLV, phân công trong chi tiết lớp trước',
                    loading: approve.isPending && approve.variables === record.id,
                    onClick: () => approve.mutate(record.id),
                  },
                  {
                    key: 'reject',
                    label: 'Từ chối',
                    danger: true,
                    loading: reject.isPending && reject.variables === record.id,
                    onClick: () =>
                      confirm({
                        title: `Từ chối lớp ${record.name}?`,
                        content: 'Lớp về trạng thái nháp.',
                        okText: 'Từ chối',
                        onOk: () => reject.mutate(record.id),
                      }),
                  },
                ]
              : []
          }
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Lớp học"
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
          {courseId && (
            <Tag
              closable
              className="!m-0"
              onClose={() => {
                setPage(1);
                void navigate({ search: {}, replace: true });
              }}
            >
              Khóa học: {course?.name ?? '…'}
            </Tag>
          )}
        </div>

        {classes.isError ? (
          <ErrorState message={toApiError(classes.error).message} onRetry={() => void classes.refetch()} />
        ) : (
          <Table<ClassSummary>
            rowKey="id"
            columns={columns}
            dataSource={classes.data?.items}
            loading={classes.isFetching}
            onRow={rowLink}
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
