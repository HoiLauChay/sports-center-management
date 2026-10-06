import { Link } from '@tanstack/react-router';
import { Button, Card, Modal, Rate, Select, Table, Tabs, Tag, type TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { DateRangeFilter, type DateRange } from '~/components/form/DateRangeFilter';
import { PageHeader } from '~/components/ui/PageHeader';
import { formatDateTime } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { formatDayLabel, isPast } from '~/lib/time';
import {
  useMyAttendance,
  useMyCheckIns,
  useMyEvaluations,
  useMyTrainingClasses,
  useSessionNote,
} from '../hooks/useTraining';
import { ATTENDANCE_TAG, CHECKIN_BASIS_LABEL, type CheckIn, type Evaluation, type MyAttendanceRow } from '../types';

function NoteModal({ sessionId, onClose }: { sessionId: string | null; onClose: () => void }) {
  const note = useSessionNote(sessionId ?? undefined);
  return (
    <Modal open={Boolean(sessionId)} onCancel={onClose} footer={null} centered destroyOnHidden title="Ghi chú buổi học">
      {note.isPending ? null : note.data ? (
        <div className="flex flex-col gap-3">
          <h3 className="m-0 text-[16px] font-semibold">{note.data.title}</h3>
          <p className="m-0 whitespace-pre-line text-sc-ink-2">{note.data.content}</p>
          {note.data.attachments.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13.5px]">
              {note.data.attachments.map((link) => (
                <li key={link}>
                  <a href={link} target="_blank" rel="noreferrer noopener">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <span className="text-[12.5px] text-sc-muted">Cập nhật {formatDateTime(note.data.updatedAt)}</span>
        </div>
      ) : (
        <EmptyState title="HLV chưa ghi chú cho buổi học này" />
      )}
    </Modal>
  );
}

function AttendanceSection() {
  const classes = useMyTrainingClasses();
  const [picked, setPicked] = useState<string | undefined>();
  const classId = picked ?? classes.data?.[0]?.id;
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

  const columns: TableColumnsType<MyAttendanceRow> = [
    { title: 'Buổi', key: 'number', width: 70, render: (_, row) => row.session.sessionNumber },
    {
      title: 'Ngày',
      key: 'date',
      render: (_, row) => (
        <span className="whitespace-nowrap">
          {formatDayLabel(row.session.date)} · {row.session.startTime}–{row.session.endTime}
        </span>
      ),
    },
    {
      title: 'Điểm danh',
      key: 'status',
      render: (_, row) =>
        row.status ? (
          <Tag color={ATTENDANCE_TAG[row.status].color} className="!m-0">
            {ATTENDANCE_TAG[row.status].label}
          </Tag>
        ) : isPast(row.session.date, row.session.startTime) ? (
          <Tag className="!m-0">Chưa điểm danh</Tag>
        ) : (
          <Tag color="processing" className="!m-0">
            Sắp tới
          </Tag>
        ),
    },
    {
      title: 'Ghi chú điểm danh',
      key: 'note',
      render: (_, row) => row.note ?? <span className="text-sc-muted-2">—</span>,
    },
    {
      title: 'Ghi chú buổi học',
      key: 'session-note',
      render: (_, row) =>
        isPast(row.session.date, row.session.startTime) ? (
          <Button size="small" onClick={() => setNoteOf(row.session.id)}>
            Xem
          </Button>
        ) : null,
    },
    {
      title: 'Đánh giá của HLV',
      key: 'evaluation',
      render: (_, row) => {
        const evaluation = evaluationOf.get(row.session.id);
        return evaluation ? (
          <div className="flex min-w-40 flex-col gap-0.5">
            <Rate disabled value={evaluation.rating} />
            {evaluation.comment && <span className="text-[13px] text-sc-ink-2">{evaluation.comment}</span>}
          </div>
        ) : null;
      },
    },
  ];

  if (classes.isError) {
    return <ErrorState message={toApiError(classes.error).message} onRetry={() => void classes.refetch()} />;
  }
  if (classes.data && classes.data.length === 0) {
    return (
      <EmptyState
        title="Bạn chưa tham gia lớp nào"
        action={
          <Link to="/classes">
            <Button type="primary">Xem lớp đang mở</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          className="w-full sm:!w-80"
          loading={classes.isPending}
          value={classId}
          onChange={setPicked}
          options={(classes.data ?? []).map((item) => ({ value: item.id, label: item.name }))}
          placeholder="Chọn lớp"
        />
        <div className="flex flex-wrap gap-2 text-[13px]">
          <Tag color="success" className="!m-0">
            Có mặt {counts.PRESENT}
          </Tag>
          <Tag color="warning" className="!m-0">
            Muộn {counts.LATE}
          </Tag>
          <Tag color="error" className="!m-0">
            Vắng {counts.ABSENT}
          </Tag>
          {done > 0 && <Tag className="!m-0">Đi học {Math.round(((counts.PRESENT + counts.LATE) / done) * 100)}%</Tag>}
        </div>
      </div>
      <Table<MyAttendanceRow>
        rowKey={(row) => row.session.id}
        size="middle"
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
    { title: 'Căn cứ', dataIndex: 'basis', render: (value: CheckIn['basis']) => CHECKIN_BASIS_LABEL[value] },
    { title: 'Lễ tân', dataIndex: ['by', 'fullName'] },
  ];

  return (
    <div className="flex flex-col gap-4">
      <DateRangeFilter value={range} onChange={setRange} />
      {history.isError && !history.data ? (
        <ErrorState message={toApiError(history.error).message} onRetry={() => void history.refetch()} />
      ) : (
        <Table<CheckIn>
          rowKey="id"
          size="middle"
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

/** `/training` (member): my attendance, session notes and coach evaluations per class, and my check-in history. */
export function TrainingPage() {
  return (
    <>
      <PageHeader title="Kết quả tập luyện" />
      <Card>
        <Tabs
          items={[
            { key: 'classes', label: 'Điểm danh & nhận xét', children: <AttendanceSection /> },
            { key: 'checkins', label: 'Lịch sử check-in', children: <CheckInHistory /> },
          ]}
        />
      </Card>
    </>
  );
}
