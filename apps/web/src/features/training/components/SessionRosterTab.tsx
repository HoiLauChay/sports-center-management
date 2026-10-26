import type { Attendance, AttendanceStatus, Evaluation } from '@sports-center/shared';
import { Alert, App, Button, Input, Radio, Rate, Tag, type TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { Table } from '~/components/data/Table';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { formatDateTime } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useAttendance, useSaveSessionRoster, useSessionEvaluations } from '../hooks/useTraining';
import { ATTENDANCE_ORDER, ATTENDANCE_TAG } from '../types';

interface Draft {
  status: AttendanceStatus | undefined;
  note: string;
  rating: number;
  comment: string;
}

interface SessionRosterTabProps {
  sessionId: string;
  /** Why attendance cannot be saved now (cancelled, before the window or too late), or null. */
  attendanceLock: string | null;
  /** The session has started, so results can be given to students who came. */
  started: boolean;
}

const attended = (status: AttendanceStatus | null | undefined) => status === 'PRESENT' || status === 'LATE';

/** One row per student: attendance, note and the session result, saved together for the whole class. */
export function SessionRosterTab({ sessionId, attendanceLock, started }: SessionRosterTabProps) {
  const { message } = App.useApp();
  const attendance = useAttendance(sessionId);
  const evaluations = useSessionEvaluations(sessionId);
  const save = useSaveSessionRoster(sessionId);
  const [edits, setEdits] = useState<Record<string, Partial<Draft>>>({});

  const rows = useMemo(() => attendance.data ?? [], [attendance.data]);
  const evaluationOf = (accountId: string) => evaluations.data?.find((entry) => entry.account.id === accountId);
  const canMark = attendanceLock === null;

  const valueOf = (record: Attendance): Draft => {
    const evaluation = evaluationOf(record.account.id);
    return {
      status: record.status ?? undefined,
      note: record.note ?? '',
      rating: evaluation?.rating ?? 0,
      comment: evaluation?.comment ?? '',
      ...edits[record.account.id],
    };
  };
  const statusOf = (record: Attendance) => (canMark ? valueOf(record).status : record.status);
  const canRate = (record: Attendance) => started && attended(statusOf(record));

  const counts = useMemo(() => {
    const result: Record<AttendanceStatus, number> = { PRESENT: 0, LATE: 0, ABSENT: 0 };
    for (const record of rows) {
      const status = canMark ? (edits[record.account.id]?.status ?? record.status) : record.status;
      if (status) result[status] += 1;
    }
    return result;
  }, [rows, edits, canMark]);
  const marked = rows.filter((record) => record.status !== null).length;

  const change = (accountId: string, patch: Partial<Draft>) =>
    setEdits((current) => ({ ...current, [accountId]: { ...current[accountId], ...patch } }));

  const submit = () => {
    const unmarked = canMark ? rows.filter((record) => !valueOf(record).status).length : 0;
    if (unmarked > 0) {
      message.error(`Còn ${unmarked} học viên chưa điểm danh.`);
      return;
    }
    const results: { accountId: string; evaluation?: Evaluation; rating: number; comment: string }[] = [];
    for (const record of rows) {
      const value = valueOf(record);
      const evaluation = evaluationOf(record.account.id);
      const keep = canRate(record) ? value.rating : 0;
      if (keep === (evaluation?.rating ?? 0) && value.comment === (evaluation?.comment ?? '')) continue;
      if (keep === 0 && !evaluation) continue;
      results.push({ accountId: record.account.id, evaluation, rating: keep, comment: value.comment });
    }
    save.mutate(
      {
        attendance: canMark
          ? rows.map((record) => {
              const value = valueOf(record);
              return { accountId: record.account.id, status: value.status!, note: value.note };
            })
          : null,
        results,
      },
      { onSuccess: () => setEdits({}) },
    );
  };

  const columns: TableColumnsType<Attendance> = [
    {
      title: 'Học viên',
      key: 'student',
      fixed: 'left',
      render: (_, record) => (
        <div className="flex min-w-32 flex-col gap-0.5">
          <b>{record.account.fullName}</b>
          {record.status === null ? (
            <Tag className="!m-0 w-fit">Chưa điểm danh</Tag>
          ) : (
            record.updatedBy &&
            record.updatedAt && (
              <span className="text-[13px] text-sc-muted">
                {record.updatedBy.fullName} · {formatDateTime(record.updatedAt)}
              </span>
            )
          )}
        </div>
      ),
    },
    {
      title: 'Điểm danh',
      key: 'status',
      render: (_, record) =>
        canMark ? (
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            className="whitespace-nowrap"
            size="small"
            value={valueOf(record).status}
            onChange={(event) => change(record.account.id, { status: event.target.value as AttendanceStatus })}
            options={ATTENDANCE_ORDER.map((status) => ({ value: status, label: ATTENDANCE_TAG[status].label }))}
          />
        ) : record.status ? (
          <Tag color={ATTENDANCE_TAG[record.status].color} className="!m-0">
            {ATTENDANCE_TAG[record.status].label}
          </Tag>
        ) : (
          <span className="text-sc-muted-2">—</span>
        ),
    },
    {
      title: 'Ghi chú',
      key: 'note',
      render: (_, record) =>
        canMark ? (
          <Input
            size="small"
            maxLength={200}
            className="min-w-36"
            placeholder="Không bắt buộc"
            value={valueOf(record).note}
            onChange={(event) => change(record.account.id, { note: event.target.value })}
          />
        ) : (
          (record.note ?? <span className="text-sc-muted-2">—</span>)
        ),
    },
    {
      title: 'Kết quả buổi',
      key: 'rating',
      render: (_, record) =>
        canRate(record) ? (
          <Rate
            allowClear
            className="!text-[18px] whitespace-nowrap"
            value={valueOf(record).rating}
            onChange={(rating) => change(record.account.id, { rating })}
          />
        ) : (
          <span className="text-[13.5px] whitespace-nowrap text-sc-muted-2">
            {started ? 'Chỉ chấm khi có mặt' : 'Sau khi buổi bắt đầu'}
          </span>
        ),
    },
    {
      title: 'Nhận xét',
      key: 'comment',
      render: (_, record) =>
        canRate(record) ? (
          <Input
            size="small"
            maxLength={2000}
            className="min-w-48"
            placeholder={valueOf(record).rating ? 'Nhận xét cho học viên' : 'Chấm điểm trước'}
            disabled={!valueOf(record).rating}
            value={valueOf(record).comment}
            onChange={(event) => change(record.account.id, { comment: event.target.value })}
          />
        ) : null,
    },
  ];

  if (attendance.isError && !attendance.data) {
    return <ErrorState message={toApiError(attendance.error).message} onRetry={() => void attendance.refetch()} />;
  }

  const savable = canMark || (started && rows.some((record) => attended(record.status)));

  return (
    <div className="flex flex-col gap-3">
      {attendanceLock && <Alert type="info" showIcon title={attendanceLock} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[14.5px]">
          <Tag color="success" className="!m-0">
            Có mặt {counts.PRESENT}
          </Tag>
          <Tag color="warning" className="!m-0">
            Muộn {counts.LATE}
          </Tag>
          <Tag color="error" className="!m-0">
            Vắng {counts.ABSENT}
          </Tag>
          <span className="text-sc-muted">
            Đã lưu {marked}/{rows.length} học viên
          </span>
        </div>
        {savable && (
          <div className="flex gap-2">
            {canMark && (
              <Button
                onClick={() =>
                  setEdits((current) =>
                    Object.fromEntries(
                      rows.map((record) => [record.account.id, { ...current[record.account.id], status: 'PRESENT' }]),
                    ),
                  )
                }
              >
                Tất cả có mặt
              </Button>
            )}
            <Button type="primary" loading={save.isPending} disabled={rows.length === 0} onClick={submit}>
              Lưu cả lớp
            </Button>
          </div>
        )}
      </div>
      <Table<Attendance>
        rowKey={(record) => record.account.id}
        size="middle"
        columns={columns}
        dataSource={rows}
        loading={(attendance.isFetching && !attendance.data) || (evaluations.isFetching && !evaluations.data)}
        pagination={false}
        locale={{ emptyText: <EmptyState title="Buổi học chưa có học viên" /> }}
      />
    </div>
  );
}
