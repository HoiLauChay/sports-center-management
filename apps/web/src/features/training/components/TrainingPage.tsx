import type { CheckIn, Evaluation, MyAttendance, MyEnrollment } from '@sports-center/shared';
import { Link } from '@tanstack/react-router';
import { Button, Card, Modal, Rate, Skeleton, Table, Tabs, Tag, type TableColumnsType } from 'antd';
import { ArrowRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { DateRangeFilter, type DateRange } from '~/components/form/DateRangeFilter';
import { PageHeader } from '~/components/ui/PageHeader';
import { SportTag } from '~/components/ui/SportTag';
import { enrollmentProgress } from '~/features/classes/components/enrollmentActions';
import { useMyEnrollments } from '~/features/classes/hooks/useClasses';
import { weeklyText } from '~/features/classes/utils';
import { formatDateTime, formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { formatDayLabel, isPast, todayVN } from '~/lib/time';
import { useMyAttendance, useMyCheckIns, useMyEvaluations, useSessionNote } from '../hooks/useTraining';
import { ATTENDANCE_TAG } from '../types';
import { MyClassTrainingTabs } from './MyClassTrainingTabs';

function NoteModal({ sessionId, onClose }: { sessionId: string | null; onClose: () => void }) {
  const note = useSessionNote(sessionId ?? undefined);
  return (
    <Modal open={Boolean(sessionId)} onCancel={onClose} footer={null} centered destroyOnHidden title="Ghi chú buổi học">
      {note.isPending ? null : note.data ? (
        <div className="flex flex-col gap-3">
          <h3 className="m-0 text-[16px] font-semibold">{note.data.title}</h3>
          <p className="m-0 whitespace-pre-line text-sc-ink-2">{note.data.content}</p>
          {note.data.homework && (
            <div className="rounded-lg bg-sc-paper p-3">
              <div className="mb-1 text-[13.5px] font-semibold text-sc-muted">Bài tập về nhà</div>
              <p className="m-0 whitespace-pre-line">{note.data.homework}</p>
            </div>
          )}
          {note.data.attachments.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[15px]">
              {note.data.attachments.map((link) => (
                <li key={link}>
                  <a href={link} target="_blank" rel="noreferrer noopener">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <span className="text-[13.5px] text-sc-muted">Cập nhật {formatDateTime(note.data.updatedAt)}</span>
        </div>
      ) : (
        <EmptyState title="HLV chưa ghi chú cho buổi học này" />
      )}
    </Modal>
  );
}

function AttendanceSection({ classId }: { classId: string }) {
  const attendance = useMyAttendance(classId);
  const evaluations = useMyEvaluations(classId);
  const [noteOf, setNoteOf] = useState<string | null>(null);

  const evaluationOf = useMemo(() => {
    const map = new Map<string, Evaluation>();
    for (const entry of evaluations.data ?? []) map.set(entry.session.id, entry);
    return map;
  }, [evaluations.data]);

  const rows = attendance.data ?? [];
  const counts = { PRESENT: 0, LATE: 0, ABSENT: 0 };
  for (const row of rows) if (row.status) counts[row.status] += 1;
  const done = counts.PRESENT + counts.LATE + counts.ABSENT;

  const columns: TableColumnsType<MyAttendance> = [
    {
      title: 'Buổi',
      key: 'number',
      width: 56,
      render: (_, row) => (
        <span className="font-display text-xl font-extrabold text-sc-muted-2">
          {String(row.session.sessionNumber).padStart(2, '0')}
        </span>
      ),
    },
    {
      title: 'Ngày',
      key: 'date',
      render: (_, row) => {
        const evaluation = evaluationOf.get(row.session.id);
        return (
          <div className="flex flex-col gap-1">
            <span className="md:whitespace-nowrap">{formatDayLabel(row.session.date)}</span>
            <span className="text-[14.5px] text-sc-muted">
              {row.session.startTime}–{row.session.endTime}
            </span>
            <div className="flex flex-col items-start gap-1 md:hidden">
              {row.note && <span className="text-[14.5px] text-sc-muted">{row.note}</span>}
              {evaluation && <Rate disabled value={evaluation.rating} className="!text-[15px]" />}
              {evaluation?.comment && <span className="text-[14.5px] text-sc-ink-2">{evaluation.comment}</span>}
              {isPast(row.session.date, row.session.startTime) && (
                <Button size="small" onClick={() => setNoteOf(row.session.id)}>
                  Ghi chú buổi học
                </Button>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Điểm danh',
      key: 'status',
      render: (_, row) => (
        <div className="flex w-40 flex-col items-start gap-1">
          {row.status ? (
            <Tag color={ATTENDANCE_TAG[row.status].color} className="!m-0">
              {ATTENDANCE_TAG[row.status].label}
            </Tag>
          ) : isPast(row.session.date, row.session.startTime) ? (
            <Tag className="!m-0">Chưa điểm danh</Tag>
          ) : (
            <Tag color="processing" className="!m-0">
              Sắp tới
            </Tag>
          )}
          {row.note && <span className="hidden text-[14.5px] text-sc-muted md:inline">{row.note}</span>}
        </div>
      ),
    },
    {
      title: 'Ghi chú buổi học',
      key: 'session-note',
      responsive: ['md'],
      render: (_, row) =>
        isPast(row.session.date, row.session.startTime) ? (
          <Button size="small" onClick={() => setNoteOf(row.session.id)}>
            Xem ghi chú
          </Button>
        ) : null,
    },
    {
      title: 'Đánh giá của HLV',
      key: 'evaluation',
      responsive: ['md'],
      render: (_, row) => {
        const evaluation = evaluationOf.get(row.session.id);
        return evaluation ? (
          <div className="flex w-56 flex-col gap-0.5">
            <Rate disabled value={evaluation.rating} />
            {evaluation.comment && <span className="text-[14.5px] text-sc-ink-2">{evaluation.comment}</span>}
          </div>
        ) : null;
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Có mặt', value: counts.PRESENT, tone: counts.PRESENT ? 'text-sc-success' : 'text-sc-ink' },
          { label: 'Đi muộn', value: counts.LATE, tone: counts.LATE ? 'text-sc-warning' : 'text-sc-ink' },
          { label: 'Vắng', value: counts.ABSENT, tone: counts.ABSENT ? 'text-sc-error' : 'text-sc-ink' },
          {
            label: 'Tỷ lệ đi học',
            value: done > 0 ? `${Math.round(((counts.PRESENT + counts.LATE) / done) * 100)}%` : '—',
            tone: 'text-sc-ink',
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-sc-border-soft bg-white px-4 py-3">
            <div className="text-[14.5px] text-sc-muted">{stat.label}</div>
            <div className={`font-display text-[24px] leading-tight font-extrabold tabular-nums ${stat.tone}`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>
      <Table<MyAttendance>
        rowKey={(row) => row.session.id}
        columns={columns}
        dataSource={rows}
        loading={attendance.isFetching}
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 12, hideOnSinglePage: true }}
        locale={{ emptyText: attendance.isFetching ? ' ' : <EmptyState title="Lớp chưa có buổi học nào" /> }}
      />
      <NoteModal sessionId={noteOf} onClose={() => setNoteOf(null)} />
    </div>
  );
}

function CheckInHistory() {
  const [range, setRange] = useState<DateRange>({});
  const history = useMyCheckIns(range);

  const columns: TableColumnsType<CheckIn> = [
    {
      title: 'Thời gian',
      dataIndex: 'checkedInAt',
      render: (value: string) => <span className="whitespace-nowrap">{formatDateTime(value)}</span>,
    },
    { title: 'Lễ tân', dataIndex: ['checkedBy', 'fullName'] },
  ];

  return (
    <div className="flex flex-col gap-4">
      <DateRangeFilter value={range} onChange={setRange} />
      {history.isError && !history.data ? (
        <ErrorState message={toApiError(history.error).message} onRetry={() => void history.refetch()} />
      ) : (
        <Table<CheckIn>
          rowKey="id"
          columns={columns}
          dataSource={history.data}
          loading={history.isFetching}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{ emptyText: history.isFetching ? ' ' : <EmptyState title="Chưa có lượt check-in nào" /> }}
        />
      )}
    </div>
  );
}

const GROUPS = [
  { key: 'active', title: 'Đang học' },
  { key: 'done', title: 'Đã kết thúc' },
  { key: 'cancelled', title: 'Đã hủy' },
] as const;

const groupOf = (enrollment: MyEnrollment) => {
  if (enrollment.status === 'CANCELLED') return 'cancelled';
  const { startDate } = enrollment.class;
  return enrollment.sessionsLeft > 0 || (startDate !== null && todayVN() < startDate) ? 'active' : 'done';
};

function ClassCardLink({ enrollment }: { enrollment: MyEnrollment }) {
  const cancelled = enrollment.status === 'CANCELLED';
  const cls = enrollment.class;
  return (
    <Link
      to={cancelled ? '/classes/$classId' : '/training/$classId'}
      params={{ classId: cls.id }}
      className={`flex min-w-0 flex-col gap-2 rounded-xl border border-sc-border-soft !bg-white p-4 !text-sc-ink no-underline [transition:border-color_0.15s] hover:!border-sc-primary-border ${cancelled ? 'opacity-75' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <SportTag name={cls.course.sport.name} />
        <ArrowRight size={16} className="shrink-0 text-sc-muted" />
      </div>
      <span className="font-display text-[20px] leading-tight font-extrabold uppercase [overflow-wrap:anywhere]">
        {cls.name}
      </span>
      <span className="text-[14.5px] text-sc-muted">
        HLV {cls.coach?.fullName ?? 'đang cập nhật'} · {weeklyText(cls.weeklySchedule)}
      </span>
      <span className={`text-[15px] font-semibold ${cancelled ? 'text-sc-muted' : 'text-sc-primary'}`}>
        {cancelled
          ? enrollment.refundedAt
            ? `Đã hủy · đã hoàn ${formatVND(enrollment.paidAmount)}`
            : 'Đã hủy'
          : enrollmentProgress(enrollment)}
      </span>
    </Link>
  );
}

function MyClasses() {
  const enrollments = useMyEnrollments();
  const groups = useMemo(() => {
    const sorted = [...(enrollments.data ?? [])].sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt));
    return GROUPS.map((group) => ({ ...group, items: sorted.filter((entry) => groupOf(entry) === group.key) })).filter(
      (group) => group.items.length > 0,
    );
  }, [enrollments.data]);

  if (enrollments.isPending) return <Skeleton active paragraph={{ rows: 4 }} />;
  if (enrollments.isError) {
    return <ErrorState message={toApiError(enrollments.error).message} onRetry={() => void enrollments.refetch()} />;
  }
  if (groups.length === 0) {
    return (
      <EmptyState
        title="Bạn chưa đăng ký lớp nào"
        action={
          <Link to="/classes">
            <Button type="primary">Xem lớp đang mở</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.key} className="flex flex-col gap-3">
          <h3 className="m-0 font-display text-[15px] font-bold tracking-[0.08em] text-sc-muted uppercase">
            {group.title} ({group.items.length})
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((enrollment) => (
              <ClassCardLink key={enrollment.id} enrollment={enrollment} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function TrainingPage() {
  return (
    <>
      <PageHeader title="Lớp của tôi" />
      <Card>
        <Tabs
          items={[
            { key: 'classes', label: 'Lớp đã đăng ký', children: <MyClasses /> },
            { key: 'checkins', label: 'Lịch sử check-in', children: <CheckInHistory /> },
          ]}
        />
      </Card>
    </>
  );
}

export function TrainingClassPage({ classId }: { classId: string }) {
  const enrollments = useMyEnrollments();
  const enrollment = enrollments.data?.find((entry) => entry.class.id === classId);

  return (
    <>
      <PageHeader
        title={enrollment?.class.name ?? 'Kết quả tập luyện'}
        description={enrollment ? `Kết quả tập luyện · ${enrollmentProgress(enrollment)}` : undefined}
        back={{ to: '/training', label: 'Lớp của tôi' }}
        extra={
          <Link to="/classes/$classId" params={{ classId }}>
            <Button>Trang lớp</Button>
          </Link>
        }
      />
      <Card>
        <MyClassTrainingTabs classId={classId} sessions={<AttendanceSection classId={classId} />} />
      </Card>
    </>
  );
}
