import type { ClassSummary } from '@sports-center/shared';
import { Alert, Button, Card, Tag, Tooltip, type TableColumnsType } from 'antd';
import { Table } from '~/components/data/Table';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { SportTag } from '~/components/ui/SportTag';
import { useMySpecializations } from '~/features/specializations/hooks/useSpecializations';
import { formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useOpenClasses, usePendingRegistrations, useRegisterToTeach } from '../hooks/useCoachClasses';
import { classDateRange } from '../utils';
import { WeeklyTags } from './ClassTableParts';

/** `/coach/open-classes` (UC_2.13, BR_2.14): drafts of the coach's approved sports that still need a coach. */
export function CoachOpenClassesPage() {
  const specializations = useMySpecializations();
  const approved = (specializations.data ?? []).filter((entry) => entry.status === 'APPROVED');
  const classes = useOpenClasses();
  const register = useRegisterToTeach();
  const pending = usePendingRegistrations();

  const sportNames = approved.map((entry) => entry.sport.name).join(', ');

  const action = (record: ClassSummary) => {
    if (pending.data?.has(record.id)) return <Tag color="warning">Đã đăng ký, chờ duyệt</Tag>;
    if (record.scheduleConflict) {
      return (
        <Tooltip title="Lớp có buổi trùng giờ với lịch dạy hiện tại của bạn.">
          <Button size="small" disabled>
            Đăng ký dạy
          </Button>
        </Tooltip>
      );
    }
    return (
      <Button
        type="primary"
        size="small"
        loading={register.isPending && register.variables === record.id}
        disabled={pending.isPending}
        onClick={() => register.mutate(record.id)}
      >
        Đăng ký dạy
      </Button>
    );
  };

  const columns: TableColumnsType<ClassSummary> = [
    {
      title: 'Lớp',
      render: (_, record) => (
        <div>
          <div className="font-semibold text-sc-ink">{record.name}</div>
          <div className="text-[13.5px] text-sc-muted">
            {record.course.name} · {formatVND(record.course.price)}
          </div>
        </div>
      ),
    },
    { title: 'Bộ môn', render: (_, record) => <SportTag name={record.course.sport.name} /> },
    {
      title: 'Lịch',
      render: (_, record) => (
        <div className="flex flex-col gap-1">
          <WeeklyTags schedule={record.weeklySchedule} />
          <span className="text-[13.5px] text-sc-muted">
            {classDateRange(record)} · {record.facility.name}
          </span>
        </div>
      ),
    },
    {
      title: 'Quy mô',
      render: (_, record) => (
        <div className="flex flex-col text-[14.5px] whitespace-nowrap">
          <span>{record.course.totalSessions} buổi</span>
          <span className="text-sc-muted">
            {record.enrolledCount > 0 ? `${record.enrolledCount}/` : ''}
            {record.minStudents}–{record.maxStudents} học viên
          </span>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      render: (_, record) => (
        <div className="flex flex-col items-start gap-1">
          <Tag color="processing" className="!m-0">
            Đang tuyển HLV
          </Tag>
          {record.scheduleConflict && (
            <Tag color="error" className="!m-0">
              Trùng lịch dạy của bạn
            </Tag>
          )}
        </div>
      ),
    },
    { key: 'action', align: 'right', width: 220, render: (_, record) => action(record) },
  ];

  return (
    <>
      <PageHeader title="Lớp cần HLV" description={`Bộ môn đã duyệt: ${sportNames || 'chưa có'}`} />
      {specializations.isSuccess && approved.length === 0 && (
        <Alert
          type="warning"
          showIcon
          className="!mb-4"
          title="Bạn chưa có chuyên môn được duyệt, hãy đăng ký chuyên môn trước khi nhận lớp."
        />
      )}
      <Card>
        {classes.isError ? (
          <ErrorState message={toApiError(classes.error).message} onRetry={() => void classes.refetch()} />
        ) : (
          <Table<ClassSummary>
            rowKey="id"
            columns={columns}
            dataSource={classes.data}
            loading={classes.isPending}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            locale={{
              emptyText: (
                <EmptyState
                  title="Chưa có lớp nào cần HLV"
                  description="Các lớp thuộc bộ môn đã duyệt của bạn hiện đã có HLV phụ trách."
                />
              ),
            }}
          />
        )}
      </Card>
    </>
  );
}
