import type { ClassDetail, ClassSession } from '@sports-center/shared';
import { Table, Tag, type TableColumnsType } from 'antd';
import { useMemo } from 'react';
import { EmptyState } from '~/components/feedback/States';
import { useCurrentUser } from '~/features/auth';
import { useCoachScheduleSpan } from '~/features/schedule';
import { useRowLink } from '~/hooks/useRowLink';
import { formatDayLabel } from '~/lib/time';
import { SESSION_PHASE_TAG, sessionPhase } from '../../utils';

/** Every session of the class with its attendance and note; a click opens the ones the coach teaches. */
export function SessionsTab({ gymClass }: { gymClass: ClassDetail }) {
  const user = useCurrentUser();
  const schedule = useCoachScheduleSpan(gymClass.startDate, gymClass.endDate);
  const taught = useMemo(() => new Map(schedule.data.map((item) => [item.id, item])), [schedule.data]);
  const rowLink = useRowLink((session: ClassSession) =>
    taught.has(session.id) && session.status !== 'CANCELLED'
      ? { to: '/coach/sessions/$sessionId', params: { sessionId: session.id } }
      : null,
  );

  const columns: TableColumnsType<ClassSession> = [
    { title: 'Buổi', dataIndex: 'sessionNumber', width: 64 },
    {
      title: 'Ngày giờ',
      render: (_, session) => (
        <span className="whitespace-nowrap">
          {formatDayLabel(session.date)} · {session.startTime}–{session.endTime}
        </span>
      ),
    },
    {
      title: 'Trạng thái',
      render: (_, session) => {
        if (session.status === 'CANCELLED') {
          return (
            <Tag color="error" className="!m-0">
              Đã hủy
            </Tag>
          );
        }
        const tag = SESSION_PHASE_TAG[sessionPhase(session)];
        return (
          <Tag color={tag.color} className="!m-0">
            {tag.label}
          </Tag>
        );
      },
    },
    {
      title: 'HLV',
      render: (_, session) =>
        session.isSubstitute ? (
          <Tag color="purple" className="!m-0">
            Dạy thay: {session.coach?.id === user.id ? 'bạn' : session.coach?.fullName}
          </Tag>
        ) : (
          <span className="text-sc-muted">HLV của lớp</span>
        ),
    },
    {
      title: 'Điểm danh',
      render: (_, session) => {
        const item = taught.get(session.id);
        if (!item || session.status === 'CANCELLED' || sessionPhase(session) === 'UPCOMING') {
          return <span className="text-sc-muted-2">—</span>;
        }
        const { marked, total } = item.attendance;
        return (
          <Tag color={marked >= total ? 'success' : 'warning'} className="!m-0">
            {marked}/{total}
          </Tag>
        );
      },
    },
    {
      title: 'Ghi chú buổi',
      render: (_, session) => {
        const item = taught.get(session.id);
        if (!item) return <span className="text-sc-muted-2">—</span>;
        return item.hasNote ? (
          <Tag color="success" className="!m-0">
            Đã có
          </Tag>
        ) : (
          <span className="text-sc-muted">Chưa có</span>
        );
      },
    },
  ];

  return (
    <Table<ClassSession>
      rowKey="id"
      size="middle"
      columns={columns}
      dataSource={gymClass.sessions}
      loading={schedule.isPending}
      pagination={false}
      scroll={{ x: 'max-content' }}
      onRow={rowLink}
      locale={{ emptyText: <EmptyState title="Lớp chưa có buổi học" /> }}
    />
  );
}
