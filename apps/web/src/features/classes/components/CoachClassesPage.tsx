import type { ClassSummary } from '@sports-center/shared';
import { COACH_WITHDRAW_NOTICE_DAYS } from '@sports-center/shared';
import { useQueries } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button, Card, Form, Input, Modal, Progress, Segmented, Space, Table, type TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { SportTag } from '~/components/ui/SportTag';
import { toApiError } from '~/lib/http-errors';
import { addDays, isPast, todayVN } from '~/lib/time';
import { useMyClasses, useWithdrawFromClass } from '../hooks/useCoachClasses';
import { classesService } from '../services/classes.service';
import { classDateRange, weeklyLines } from '../utils';
import { ClassStatusTag } from './ClassTableParts';

type Group = 'ONGOING' | 'UPCOMING' | 'ENDED';

const GROUP_LABEL: Record<Group, string> = { ONGOING: 'Đang dạy', UPCOMING: 'Sắp khai giảng', ENDED: 'Đã kết thúc' };

const groupOf = (item: ClassSummary): Group => {
  if (item.status === 'CANCELLED' || item.derivedStatus === 'COMPLETED') return 'ENDED';
  return item.derivedStatus === 'ONGOING' ? 'ONGOING' : 'UPCOMING';
};

/** BR_2.16: a coach leaves a class only while its first session is at least a week away. */
const canWithdraw = (item: ClassSummary) =>
  (item.status === 'OPEN' || item.status === 'PENDING_APPROVAL') &&
  (!item.startDate || item.startDate >= addDays(todayVN(), COACH_WITHDRAW_NOTICE_DAYS));

/** `/coach/classes`: the classes this coach teaches, by phase, with each class's progress (UC_2.21). */
export function CoachClassesPage() {
  const classes = useMyClasses();
  const withdraw = useWithdrawFromClass();
  const [leaving, setLeaving] = useState<ClassSummary | null>(null);
  const [reason, setReason] = useState('');
  const [picked, setPicked] = useState<Group | null>(null);

  const groups = useMemo(() => {
    const result: Record<Group, ClassSummary[]> = { ONGOING: [], UPCOMING: [], ENDED: [] };
    for (const item of classes.data ?? []) result[groupOf(item)].push(item);
    return result;
  }, [classes.data]);
  const group = picked ?? (groups.ONGOING.length > 0 || groups.UPCOMING.length === 0 ? 'ONGOING' : 'UPCOMING');
  const shown = groups[group];

  const details = useQueries({
    queries: shown
      .filter((item) => item.status !== 'CANCELLED')
      .map((item) => ({ queryKey: ['classes', 'detail', item.id], queryFn: () => classesService.get(item.id) })),
  });
  const progressOf = (classId: string) => {
    const detail = details.find((query) => query.data?.id === classId)?.data;
    if (!detail) return null;
    const sessions = detail.sessions.filter((session) => session.status === 'SCHEDULED');
    return { done: sessions.filter((session) => isPast(session.date, session.endTime)).length, total: sessions.length };
  };

  const closeWithdraw = () => {
    setLeaving(null);
    setReason('');
  };

  const columns: TableColumnsType<ClassSummary> = [
    {
      title: 'Lớp',
      render: (_, record) => (
        <div className="flex min-w-36 flex-col items-start gap-1">
          <Link to="/coach/classes/$classId" params={{ classId: record.id }} className="font-semibold">
            {record.name}
          </Link>
          <SportTag name={record.course.sport.name} />
        </div>
      ),
    },
    {
      title: 'Lịch',
      render: (_, record) => (
        <div className="flex flex-col text-[14.5px] whitespace-nowrap">
          {weeklyLines(record.weeklySchedule).map((line) => (
            <span key={line}>{line}</span>
          ))}
          <span className="text-[13.5px] text-sc-muted">{classDateRange(record)}</span>
        </div>
      ),
    },
    { title: 'Học viên', render: (_, record) => `${record.enrolledCount}/${record.maxStudents}` },
    {
      title: 'Tiến độ',
      render: (_, record) => {
        const progress = progressOf(record.id);
        if (!progress) return <span className="text-sc-muted-2">—</span>;
        return (
          <div className="flex min-w-32 flex-col">
            <span className="text-[14px]">
              {progress.done}/{progress.total} buổi
            </span>
            <Progress
              percent={progress.total ? Math.round((progress.done / progress.total) * 100) : 0}
              showInfo={false}
              size="small"
            />
          </div>
        );
      },
    },
    { title: 'Trạng thái', render: (_, record) => <ClassStatusTag item={record} /> },
    {
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <div className="flex flex-col items-end gap-1">
          <Space>
            <Link to="/coach/classes/$classId" params={{ classId: record.id }}>
              <Button size="small">Chi tiết</Button>
            </Link>
            {canWithdraw(record) && (
              <Button size="small" danger onClick={() => setLeaving(record)}>
                Rút khỏi lớp
              </Button>
            )}
          </Space>
          {group === 'UPCOMING' && !canWithdraw(record) && record.status !== 'CANCELLED' && (
            <span className="w-52 text-right text-[13px] whitespace-normal text-sc-muted">
              Còn dưới {COACH_WITHDRAW_NOTICE_DAYS} ngày đến buổi đầu, liên hệ Manager nếu cần rút.
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Lớp phụ trách" />
      <Card>
        {classes.isError ? (
          <ErrorState message={toApiError(classes.error).message} onRetry={() => void classes.refetch()} />
        ) : (
          <>
            <Segmented
              className="!mb-4"
              value={group}
              onChange={(value) => setPicked(value as Group)}
              options={(Object.keys(GROUP_LABEL) as Group[]).map((key) => ({
                value: key,
                label: `${GROUP_LABEL[key]} (${groups[key].length})`,
              }))}
            />
            <Table<ClassSummary>
              rowKey="id"
              columns={columns}
              dataSource={shown}
              loading={classes.isPending}
              scroll={{ x: 'max-content' }}
              pagination={{ pageSize: 10, hideOnSinglePage: true }}
              locale={{
                emptyText: (
                  <EmptyState
                    title={`Không có lớp ${GROUP_LABEL[group].toLowerCase()}`}
                    description="Đăng ký dạy ở mục Lớp cần HLV, lớp sẽ hiện ở đây khi Quản lý chọn bạn."
                  />
                ),
              }}
            />
          </>
        )}
      </Card>
      <Modal
        open={Boolean(leaving)}
        centered
        destroyOnHidden
        title={`Rút khỏi ${leaving?.name ?? ''}?`}
        okText="Rút khỏi lớp"
        okButtonProps={{ danger: true, disabled: !reason.trim() }}
        cancelText="Không"
        confirmLoading={withdraw.isPending}
        onCancel={closeWithdraw}
        onOk={() =>
          leaving && withdraw.mutate({ classId: leaving.id, reason: reason.trim() }, { onSuccess: closeWithdraw })
        }
      >
        <p className="mt-0">Lớp quay về chờ HLV. Quản lý nhận được lý do của bạn.</p>
        <Form layout="vertical">
          <Form.Item label="Lý do" required>
            <Input.TextArea
              rows={3}
              maxLength={500}
              showCount
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="VD: Trùng lịch công tác"
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
