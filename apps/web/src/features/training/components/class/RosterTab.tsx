import type { ClassSession, RosterEntry } from '@sports-center/shared';
import { PROGRESS_MILESTONES } from '@sports-center/shared';
import { Rate, Tag, type TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { Table } from '~/components/data/Table';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { clickableRow } from '~/hooks/useRowLink';
import { toApiError } from '~/lib/http-errors';
import { useRoster } from '../../hooks/useClassTraining';
import { MILESTONE_LABEL, reachedMilestones } from '../../utils';
import { StudentDrawer } from './StudentDrawer';

interface RosterTabProps {
  classId: string;
  sessions: ClassSession[];
  readOnly: boolean;
}

/** The class's students with their goals, health notes, attendance, latest result, plan and reviews (UC_2.21). */
export function RosterTab({ classId, sessions, readOnly }: RosterTabProps) {
  const roster = useRoster(classId);
  const [selected, setSelected] = useState<RosterEntry | null>(null);
  const [open, setOpen] = useState(false);
  const reached = useMemo(() => reachedMilestones(sessions), [sessions]);

  const columns: TableColumnsType<RosterEntry> = [
    {
      title: 'Học viên',
      fixed: 'left',
      render: (_, entry) => (
        <div className="flex min-w-32 flex-col">
          <b className="text-sc-primary">{entry.account.fullName}</b>
          {entry.account.phone && <span className="text-[13.5px] text-sc-muted">{entry.account.phone}</span>}
        </div>
      ),
    },
    {
      title: 'Mục tiêu',
      render: (_, entry) => (
        <span className="line-clamp-2 min-w-32">
          {entry.fitnessGoals ?? <span className="text-sc-muted-2">—</span>}
        </span>
      ),
    },
    {
      title: 'Sức khỏe',
      render: (_, entry) =>
        entry.healthNotes ? (
          <Tag color="warning" className="!m-0 max-w-48 !whitespace-normal">
            {entry.healthNotes}
          </Tag>
        ) : (
          <span className="text-sc-muted-2">—</span>
        ),
    },
    {
      title: 'Chuyên cần',
      render: (_, { attendance }) => (
        <div className="flex flex-col text-[14px] whitespace-nowrap">
          <span>
            <span className="text-sc-success">{attendance.present} có mặt</span> · {attendance.late} muộn ·{' '}
            <span className={attendance.absent ? 'text-sc-error' : ''}>{attendance.absent} vắng</span>
          </span>
          {attendance.unmarked > 0 && <span className="text-sc-muted">{attendance.unmarked} chưa điểm danh</span>}
        </div>
      ),
    },
    {
      title: 'Kết quả gần nhất',
      render: (_, entry) =>
        entry.lastResult ? (
          <div className="flex flex-col whitespace-nowrap">
            <Rate disabled value={entry.lastResult.rating} className="!text-[14px]" />
            <span className="text-[13px] text-sc-muted">buổi {entry.lastResult.sessionNumber}</span>
          </div>
        ) : (
          <span className="text-sc-muted-2">—</span>
        ),
    },
    {
      title: 'Tiến độ',
      render: (_, entry) => (
        <div className="flex flex-wrap gap-1">
          <Tag color={entry.planUpdatedAt ? 'success' : undefined} className="!m-0">
            {entry.planUpdatedAt ? 'Có kế hoạch' : 'Chưa có kế hoạch'}
          </Tag>
          {PROGRESS_MILESTONES.filter((milestone) => reached[milestone] || entry.reviews.includes(milestone)).map(
            (milestone) => {
              const done = entry.reviews.includes(milestone);
              return (
                <Tag key={milestone} color={done ? 'success' : 'warning'} className="!m-0">
                  {MILESTONE_LABEL[milestone]}: {done ? 'đã đánh giá' : 'chưa đánh giá'}
                </Tag>
              );
            },
          )}
        </div>
      ),
    },
  ];

  if (roster.isError && !roster.data) {
    return <ErrorState message={toApiError(roster.error).message} onRetry={() => void roster.refetch()} />;
  }

  return (
    <>
      <Table<RosterEntry>
        rowKey={(entry) => entry.account.id}
        size="middle"
        columns={columns}
        dataSource={roster.data}
        loading={roster.isPending}
        pagination={false}
        onRow={(entry) =>
          clickableRow(() => {
            setSelected(entry);
            setOpen(true);
          })
        }
        locale={{ emptyText: <EmptyState title="Lớp chưa có học viên" /> }}
      />
      <StudentDrawer
        classId={classId}
        entry={selected}
        open={open}
        reached={reached}
        readOnly={readOnly}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
