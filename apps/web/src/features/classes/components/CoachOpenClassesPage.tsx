import type { ClassSummary } from '@sports-center/shared';
import { Alert, Button, Card, Table, Tag, type TableColumnsType } from 'antd';
import { useState } from 'react';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useApprovedSpecializations, useOpenClasses, useRegisterToTeach } from '../hooks/useCoachClasses';
import { CLASS_STATUS_TAG, classDateRange } from '../utils';
import { WeeklyTags } from './ClassTableParts';

/** `/coach/open-classes` (UC_2.13, BR_2.14): drafts of the coach's approved sports that still need a coach. */
export function CoachOpenClassesPage() {
  const specializations = useApprovedSpecializations();
  const classes = useOpenClasses();
  const register = useRegisterToTeach();
  // The API does not return a coach's own registrations, so the ones made here are remembered for this visit.
  const [registered, setRegistered] = useState<ReadonlySet<string>>(new Set());

  const sportNames = (specializations.data ?? []).map((specialization) => specialization.sport.name).join(', ');

  const action = (record: ClassSummary) => {
    if (registered.has(record.id)) return <Tag color="warning">Đã đăng ký, chờ duyệt</Tag>;
    return (
      <Button
        type="primary"
        size="small"
        loading={register.isPending && register.variables === record.id}
        onClick={() =>
          register.mutate(record.id, { onSuccess: () => setRegistered((ids) => new Set(ids).add(record.id)) })
        }
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
          <div className="text-xs text-sc-muted">
            {record.course.name} · {formatVND(record.course.price)}
          </div>
        </div>
      ),
    },
    { title: 'Bộ môn', render: (_, record) => <Tag color="green">{record.course.sport.name}</Tag> },
    {
      title: 'Lịch',
      render: (_, record) => (
        <div className="flex flex-col gap-1">
          <WeeklyTags schedule={record.weeklySchedule} />
          <span className="text-xs text-sc-muted">
            {classDateRange(record)} · {record.facility.name}
          </span>
        </div>
      ),
    },
    {
      title: 'Trạng thái lớp',
      render: (_, record) => {
        const tag = CLASS_STATUS_TAG[record.status];
        return <Tag color={tag.color}>{tag.label}</Tag>;
      },
    },
    { key: 'action', align: 'right', width: 220, render: (_, record) => action(record) },
  ];

  return (
    <>
      <PageHeader
        title="Lớp cần HLV"
        description={`Bộ môn đã duyệt: ${sportNames || 'chưa có'} — chỉ hiện lớp nháp / chờ duyệt chưa có HLV.`}
      />
      {specializations.isSuccess && specializations.data.length === 0 && (
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
            scroll={{ x: 960 }}
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
