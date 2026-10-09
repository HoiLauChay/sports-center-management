import type { Attendance, AttendanceStatus } from '@sports-center/shared';
import { Alert, Button, Input, Radio, Table, Tag, type TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { formatDateTime } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useAttendance, useSaveAttendance } from '../hooks/useTraining';
import { ATTENDANCE_ORDER, ATTENDANCE_TAG } from '../types';

interface Draft {
  status: AttendanceStatus;
  note: string;
}

interface AttendanceTabProps {
  sessionId: string;
  /** False once the session or its class was cancelled. */
  editable: boolean;
  /** The session has not started yet: it can still be saved, but the coach is reminded. */
  upcoming: boolean;
}

/** Marks the whole class in one save; students not marked yet start as present so the coach only changes exceptions. */
export function AttendanceTab({ sessionId, editable, upcoming }: AttendanceTabProps) {
  const attendance = useAttendance(sessionId);
  const save = useSaveAttendance(sessionId);
  // What the coach changed on screen; everything else shows what is saved (unmarked students count as present).
  const [edits, setEdits] = useState<Record<string, Partial<Draft>>>({});

  const rows = useMemo(() => attendance.data ?? [], [attendance.data]);
  const valueOf = (record: Attendance): Draft => ({
    status: record.status ?? 'PRESENT',
    note: record.note ?? '',
    ...edits[record.account.id],
  });
  const marked = rows.filter((record) => record.status !== null).length;
  const counts = useMemo(() => {
    const result: Record<AttendanceStatus, number> = { PRESENT: 0, LATE: 0, ABSENT: 0 };
    for (const record of rows) result[edits[record.account.id]?.status ?? record.status ?? 'PRESENT'] += 1;
    return result;
  }, [rows, edits]);

  const change = (accountId: string, patch: Partial<Draft>) =>
    setEdits((current) => ({ ...current, [accountId]: { ...current[accountId], ...patch } }));

  const submit = () =>
    save.mutate(
      {
        records: rows.map((record) => {
          const value = valueOf(record);
          return { accountId: record.account.id, status: value.status, note: value.note };
        }),
      },
      { onSuccess: () => setEdits({}) },
    );

  const columns: TableColumnsType<Attendance> = [
    {
      title: 'Học viên',
      key: 'student',
      render: (_, record) => (
        <div className="flex min-w-36 flex-col gap-0.5">
          <b>{record.account.fullName}</b>
          {record.status === null && (
            <Tag className="!m-0 w-fit" color="default">
              Chưa điểm danh
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Điểm danh',
      key: 'status',
      render: (_, record) => (
        <Radio.Group
          optionType="button"
          buttonStyle="solid"
          size="small"
          disabled={!editable}
          value={valueOf(record).status}
          onChange={(event) => change(record.account.id, { status: event.target.value as AttendanceStatus })}
          options={ATTENDANCE_ORDER.map((status) => ({ value: status, label: ATTENDANCE_TAG[status].label }))}
        />
      ),
    },
    {
      title: 'Ghi chú',
      key: 'note',
      render: (_, record) => (
        <Input
          size="small"
          maxLength={200}
          disabled={!editable}
          className="min-w-40"
          placeholder="Ghi chú (không bắt buộc)"
          value={valueOf(record).note}
          onChange={(event) => change(record.account.id, { note: event.target.value })}
        />
      ),
    },
    {
      title: 'Cập nhật',
      key: 'updated',
      render: (_, record) =>
        record.updatedAt && record.updatedBy ? (
          <span className="text-[12.5px] whitespace-nowrap text-sc-muted">
            {record.updatedBy.fullName} · {formatDateTime(record.updatedAt)}
          </span>
        ) : null,
    },
  ];

  if (attendance.isError && !attendance.data) {
    return <ErrorState message={toApiError(attendance.error).message} onRetry={() => void attendance.refetch()} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {upcoming && editable && (
        <Alert
          type="info"
          showIcon
          title="Buổi học chưa diễn ra. Bạn vẫn lưu được, nhưng nên điểm danh khi buổi đã bắt đầu."
        />
      )}
      {!editable && <Alert type="warning" showIcon title="Buổi học đã bị hủy nên không điểm danh được." />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
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
        {editable && (
          <div className="flex gap-2">
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
            <Button type="primary" loading={save.isPending} disabled={rows.length === 0} onClick={submit}>
              {marked > 0 ? 'Cập nhật điểm danh' : 'Lưu điểm danh cả lớp'}
            </Button>
          </div>
        )}
      </div>
      <Table<Attendance>
        rowKey={(record) => record.account.id}
        size="middle"
        columns={columns}
        dataSource={rows}
        loading={attendance.isFetching && !attendance.data}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <EmptyState title="Buổi học chưa có học viên" /> }}
      />
    </div>
  );
}
