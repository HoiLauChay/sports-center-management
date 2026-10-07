import { Link } from '@tanstack/react-router';
import { Button, Card, Popconfirm, Segmented, Space, Table, Tag, Tooltip, type TableColumnsType } from 'antd';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useApproveClassFromList, useManagerClasses, useRejectClassFromList } from '../hooks/useClassAdmin';
import type { ManagerClassItem } from '../services/classAdmin.service';
import { classAdminActions, classDateRange, weeklyLines } from '../utils';
import { CancelClassModal } from './ClassAdminModals';
import { ClassCreateModal } from './ClassCreateModal';
import { ClassStatusTag } from './ClassTableParts';

type Phase = 'ALL' | 'PENDING' | 'NEED_COACH' | 'OPEN' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';

const IN_PHASE: Record<Phase, (item: ManagerClassItem) => boolean> = {
  ALL: () => true,
  PENDING: (item) => item.status === 'PENDING_APPROVAL',
  NEED_COACH: (item) => !item.coach && item.status !== 'CANCELLED' && item.derivedStatus !== 'COMPLETED',
  OPEN: (item) => item.status === 'OPEN' && item.derivedStatus === 'UPCOMING',
  ONGOING: (item) => item.status === 'OPEN' && item.derivedStatus === 'ONGOING',
  COMPLETED: (item) => item.status === 'OPEN' && item.derivedStatus === 'COMPLETED',
  CANCELLED: (item) => item.status === 'CANCELLED',
};

/** `/admin/classes` (UC_2.12/2.15/2.18): every class, pending approvals first, approved or cancelled from the list. */
export function ClassesAdminPage() {
  const classes = useManagerClasses();
  const approve = useApproveClassFromList();
  const reject = useRejectClassFromList();
  const [phase, setPhase] = useState<Phase>('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [cancelling, setCancelling] = useState<ManagerClassItem | null>(null);

  const all = classes.data ?? [];
  const pendingCount = all.filter(IN_PHASE.PENDING).length;
  const rows = all.filter(IN_PHASE[phase]).sort((a, b) => Number(IN_PHASE.PENDING(b)) - Number(IN_PHASE.PENDING(a)));

  const columns: TableColumnsType<ManagerClassItem> = [
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
    { title: 'Facility', render: (_, record) => record.facility.name },
    {
      title: 'HLV',
      render: (_, record) =>
        record.coach ? (
          <span className="whitespace-nowrap">{record.coach.fullName}</span>
        ) : (
          <span className="whitespace-nowrap text-orange-500">Chưa có · {record.pendingRegistrations} đăng ký</span>
        ),
    },
    {
      title: 'Sĩ số',
      render: (_, record) => (
        <div className="leading-tight">
          <div className="font-semibold">
            {record.enrolledCount}/{record.maxStudents}
          </div>
          <div className="text-xs text-sc-muted">min {record.minStudents}</div>
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
      render: (_, record) => (
        <div className="whitespace-nowrap text-xs leading-tight">
          <div>{classDateRange(record)}</div>
          <div className="text-sc-muted">{record.sessionCount} buổi</div>
        </div>
      ),
    },
    { title: 'Trạng thái', render: (_, record) => <ClassStatusTag item={record} /> },
    {
      key: 'actions',
      align: 'right',
      width: 190,
      render: (_, record) => {
        const actions = classAdminActions(record);
        if (actions.reject) {
          return (
            <Space size={4}>
              <Tooltip title={actions.approve ? undefined : 'Lớp chưa có HLV, phân công trong chi tiết lớp trước'}>
                <Button
                  size="small"
                  type="primary"
                  disabled={!actions.approve}
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
          );
        }
        return (
          <Space size={4}>
            <Link to="/admin/classes/$classId" params={{ classId: record.id }}>
              <Button size="small">Chi tiết</Button>
            </Link>
            {actions.cancel && (
              <Button size="small" danger onClick={() => setCancelling(record)}>
                Hủy
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Lớp học"
        description="Lớp = section của khóa học. Sinh buổi học từ lịch tuần, giữ slot facility từ DRAFT, cần HLV + duyệt để OPEN."
        extra={
          <Button type="primary" icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
            Tạo lớp
          </Button>
        }
      />

      <Segmented<Phase>
        className="!mb-4 max-w-full overflow-x-auto"
        value={phase}
        onChange={setPhase}
        options={[
          { value: 'ALL', label: 'Tất cả' },
          { value: 'PENDING', label: `Chờ duyệt (${pendingCount})` },
          { value: 'NEED_COACH', label: 'Cần HLV' },
          { value: 'OPEN', label: 'Đang mở' },
          { value: 'ONGOING', label: 'Đang học' },
          { value: 'COMPLETED', label: 'Kết thúc' },
          { value: 'CANCELLED', label: 'Đã hủy' },
        ]}
      />

      <Card styles={{ body: { padding: 0 } }}>
        {classes.isError ? (
          <ErrorState message={toApiError(classes.error).message} onRetry={() => void classes.refetch()} />
        ) : (
          <Table<ManagerClassItem>
            rowKey="id"
            columns={columns}
            dataSource={rows}
            loading={classes.isPending}
            scroll={{ x: 1100 }}
            pagination={{ pageSize: 10, showSizeChanger: false, hideOnSinglePage: true }}
            locale={{
              emptyText: (
                <EmptyState title="Không có lớp nào" description="Bấm 'Tạo lớp' để chia lớp cho một khóa học." />
              ),
            }}
          />
        )}
      </Card>

      <ClassCreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {cancelling && <CancelClassModal open item={cancelling} onClose={() => setCancelling(null)} />}
    </>
  );
}
