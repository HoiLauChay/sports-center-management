import { ATTENDANCE_RULES, type Attendance, type AttendanceStatus, type Evaluation } from '@sports-center/shared';
import { Link } from '@tanstack/react-router';
import { Alert, App, Button, Card, Drawer, Input, Radio, Rate, Spin, Tabs, Tag, type TableColumnsType } from 'antd';
import {
  BookOpenCheck,
  CalendarDays,
  Clock,
  ExternalLink,
  FileText,
  History,
  MapPin,
  Paperclip,
  RotateCcw,
  ShieldCheck,
  Star,
  UserCheck,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Table } from '~/components/data/Table';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { SectionTitle } from '~/components/ui/SectionTitle';
import {
  useAttendance,
  useSessionEvaluations,
  useSessionNote,
  useTrainingSession,
} from '~/features/training/hooks/useTraining';
import { ATTENDANCE_ORDER, ATTENDANCE_TAG } from '~/features/training/types';
import { SESSION_PHASE_TAG, sessionPhase } from '~/features/training/utils';
import { formatDateTime } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { addDays, formatDayLabel, fromMinutes, isPast, todayVN, toMinutes } from '~/lib/time';
import { useSaveManagerAttendance } from '../hooks/useClassAdmin';
import type { ClassSession } from '../types';

interface AttendanceDraft {
  status?: AttendanceStatus;
  note?: string;
}

interface ManagerAttendancePanelProps {
  classId: string;
  session: ClassSession;
  classCancelled: boolean;
}

const attachmentFileName = (url: string) => decodeURIComponent(url.split('/').at(-1) ?? url);

function managerLockReason(session: ClassSession, classCancelled: boolean): string | null {
  if (classCancelled) return 'Lớp học đã bị hủy nên danh sách điểm danh ở chế độ chỉ đọc.';
  if (session.status === 'CANCELLED') return 'Buổi học này đã bị hủy nên không thể điểm danh.';
  const opensAt = fromMinutes(Math.max(toMinutes(session.startTime) - ATTENDANCE_RULES.OPENS_MINUTES_BEFORE, 0));
  if (!isPast(session.date, opensAt)) {
    return `Buổi học chưa bắt đầu (mở điểm danh từ ${opensAt}, ${ATTENDANCE_RULES.OPENS_MINUTES_BEFORE} phút trước giờ học).`;
  }
  return null;
}

function ManagerAttendancePanel({ classId, session, classCancelled }: ManagerAttendancePanelProps) {
  const { message } = App.useApp();
  const attendance = useAttendance(session.id);
  const evaluations = useSessionEvaluations(session.id);
  const save = useSaveManagerAttendance(classId, session.id);
  const [edits, setEdits] = useState<Record<string, AttendanceDraft>>({});

  const rows = useMemo(() => attendance.data ?? [], [attendance.data]);
  const evaluationMap = useMemo(() => {
    const map = new Map<string, Evaluation>();
    for (const item of evaluations.data ?? []) {
      map.set(item.account.id, item);
    }
    return map;
  }, [evaluations.data]);

  const avgRating = useMemo(() => {
    const items = evaluations.data ?? [];
    if (items.length === 0) return null;
    const sum = items.reduce((acc, item) => acc + item.rating, 0);
    return Math.round((sum / items.length) * 10) / 10;
  }, [evaluations.data]);

  const lockReason = managerLockReason(session, classCancelled);
  const canEdit = lockReason === null;
  const isCoachWindowExpired =
    session.status === 'SCHEDULED' && todayVN() > addDays(session.date, ATTENDANCE_RULES.COACH_EDIT_DAYS);
  const hasEdits = Object.keys(edits).length > 0;

  const statusOf = (record: Attendance): AttendanceStatus | undefined =>
    canEdit ? (edits[record.account.id]?.status ?? record.status ?? undefined) : (record.status ?? undefined);

  const noteOf = (record: Attendance): string =>
    canEdit ? (edits[record.account.id]?.note ?? record.note ?? '') : (record.note ?? '');

  const counts = useMemo(() => {
    const summary = { PRESENT: 0, LATE: 0, ABSENT: 0, UNMARKED: 0 };
    for (const record of rows) {
      const status = canEdit ? (edits[record.account.id]?.status ?? record.status) : record.status;
      if (status) summary[status] += 1;
      else summary.UNMARKED += 1;
    }
    return summary;
  }, [rows, edits, canEdit]);

  const savedCount = useMemo(() => rows.filter((record) => record.status !== null).length, [rows]);

  const updateRow = (accountId: string, patch: AttendanceDraft) => {
    setEdits((prev) => ({
      ...prev,
      [accountId]: { ...prev[accountId], ...patch },
    }));
  };

  const markAllPresent = () => {
    setEdits((prev) =>
      Object.fromEntries(rows.map((record) => [record.account.id, { ...prev[record.account.id], status: 'PRESENT' }])),
    );
  };

  const fillUnmarkedPresent = () => {
    setEdits((prev) => {
      const next = { ...prev };
      for (const record of rows) {
        const current = next[record.account.id]?.status ?? record.status;
        if (!current) {
          next[record.account.id] = { ...next[record.account.id], status: 'PRESENT' };
        }
      }
      return next;
    });
  };

  const handleSubmit = () => {
    const unmarked = rows.filter((record) => !statusOf(record)).length;
    if (unmarked > 0) {
      message.warning(`Còn ${unmarked} học viên chưa chọn trạng thái điểm danh.`);
      return;
    }
    save.mutate(
      {
        records: rows.map((record) => ({
          accountId: record.account.id,
          status: statusOf(record)!,
          note: noteOf(record).trim(),
        })),
      },
      { onSuccess: () => setEdits({}) },
    );
  };

  if (attendance.isError && !attendance.data) {
    return <ErrorState message={toApiError(attendance.error).message} onRetry={() => void attendance.refetch()} />;
  }

  const columns: TableColumnsType<Attendance> = [
    {
      title: 'Học viên',
      key: 'student',
      width: 215,
      render: (_, record) => {
        const isDirty = edits[record.account.id] !== undefined;
        return (
          <div className="flex min-w-40 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Link
                to="/admin/users/$userId"
                params={{ userId: record.account.id }}
                className="font-semibold text-sc-ink hover:text-sc-primary"
              >
                {record.account.fullName}
              </Link>
              {isDirty && (
                <Tag color="gold" className="!m-0 !text-[11.5px]">
                  Chưa lưu
                </Tag>
              )}
            </div>
            {record.status === null ? (
              <span className="text-[12.5px] text-amber-600">Chưa có bản ghi điểm danh</span>
            ) : record.updatedBy && record.updatedAt ? (
              <span className="inline-flex items-center gap-1 text-[12.5px] text-sc-muted">
                <History size={12} className="shrink-0" />
                {record.updatedBy.fullName} · {formatDateTime(record.updatedAt)}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      title: 'Điểm danh',
      key: 'status',
      width: 215,
      render: (_, record) =>
        canEdit ? (
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            size="small"
            className="whitespace-nowrap"
            value={statusOf(record)}
            onChange={(event) => updateRow(record.account.id, { status: event.target.value as AttendanceStatus })}
            options={ATTENDANCE_ORDER.map((status) => ({
              value: status,
              label: ATTENDANCE_TAG[status].label,
            }))}
          />
        ) : record.status ? (
          <Tag color={ATTENDANCE_TAG[record.status].color} className="!m-0">
            {ATTENDANCE_TAG[record.status].label}
          </Tag>
        ) : (
          <Tag className="!m-0">Chưa điểm danh</Tag>
        ),
    },
    {
      title: 'Ghi chú điểm danh',
      key: 'note',
      width: 210,
      render: (_, record) =>
        canEdit ? (
          <Input
            size="small"
            maxLength={200}
            placeholder="Lý do đi muộn / vắng..."
            value={noteOf(record)}
            onChange={(event) => updateRow(record.account.id, { note: event.target.value })}
          />
        ) : record.note ? (
          <span className="text-[13.5px] text-sc-ink-2">{record.note}</span>
        ) : (
          <span className="text-sc-muted-2">—</span>
        ),
    },
    {
      title: 'Đánh giá của HLV (chỉ đọc)',
      key: 'evaluation',
      render: (_, record) => {
        const evaluation = evaluationMap.get(record.account.id);
        if (!evaluation) {
          return <span className="text-[13px] text-sc-muted-2">Chưa có đánh giá</span>;
        }
        return (
          <div className="flex min-w-44 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <Rate disabled value={evaluation.rating} className="!text-[13.5px] whitespace-nowrap" />
              <span className="text-[12px] font-semibold text-sc-muted tabular-nums">{evaluation.rating}/5</span>
            </div>
            {evaluation.comment && (
              <span className="line-clamp-2 text-[13px] text-sc-ink-2" title={evaluation.comment}>
                {evaluation.comment}
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-3.5">
      {lockReason ? (
        <Alert type="info" showIcon title={lockReason} />
      ) : isCoachWindowExpired ? (
        <Alert
          type="warning"
          showIcon
          icon={<ShieldCheck size={16} />}
          title={`Buổi học đã quá hạn ${ATTENDANCE_RULES.COACH_EDIT_DAYS} ngày của HLV — Quản lý có quyền bổ sung hoặc hiệu chỉnh điểm danh (mọi thay đổi được ghi vào Lịch sử thao tác).`}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-sc-border-soft bg-sc-paper/50 px-3.5 py-2.5">
        <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
          <Tag color="success" className="!m-0">
            Có mặt {counts.PRESENT}
          </Tag>
          <Tag color="warning" className="!m-0">
            Muộn {counts.LATE}
          </Tag>
          <Tag color="error" className="!m-0">
            Vắng {counts.ABSENT}
          </Tag>
          {counts.UNMARKED > 0 && (
            <Tag color="default" className="!m-0">
              Chưa chọn {counts.UNMARKED}
            </Tag>
          )}
          <span className="text-sc-muted">
            Đã lưu {savedCount}/{rows.length} HV
          </span>
          {avgRating !== null && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[12.5px] font-semibold text-amber-700">
              <Star size={12} className="fill-amber-500 text-amber-500" />
              TB {avgRating.toLocaleString('vi-VN')}/5 ({evaluations.data?.length ?? 0} ĐG)
            </span>
          )}
        </div>

        {canEdit && rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {counts.UNMARKED > 0 && counts.UNMARKED < rows.length && (
              <Button size="small" onClick={fillUnmarkedPresent}>
                Điền có mặt ({counts.UNMARKED})
              </Button>
            )}
            <Button size="small" onClick={markAllPresent}>
              Tất cả có mặt
            </Button>
            {hasEdits && (
              <Button size="small" icon={<RotateCcw size={13} />} onClick={() => setEdits({})}>
                Hoàn tác
              </Button>
            )}
            <Button type="primary" size="small" loading={save.isPending} onClick={handleSubmit}>
              Lưu điểm danh
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
        locale={{ emptyText: <EmptyState title="Buổi học chưa có học viên đăng ký" /> }}
      />
    </div>
  );
}

function ManagerSessionNotePanel({ sessionId }: { sessionId: string }) {
  const note = useSessionNote(sessionId);

  if (note.isPending) {
    return (
      <div className="flex justify-center py-10">
        <Spin />
      </div>
    );
  }

  if (note.isError) {
    return <ErrorState message={toApiError(note.error).message} onRetry={() => void note.refetch()} />;
  }

  const saved = note.data;
  if (!saved) {
    return (
      <EmptyState
        title="HLV chưa tạo ghi chú cho buổi học này"
        description="Nội dung giảng dạy, bài tập về nhà và tài liệu đính kèm sẽ hiển thị tại đây sau khi huấn luyện viên cập nhật."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      <Alert
        type="info"
        showIcon
        title={`Ghi chú do huấn luyện viên cập nhật lúc ${formatDateTime(saved.updatedAt)} · Chế độ chỉ đọc cho quản lý.`}
      />

      <Card size="small">
        <div className="mb-1 inline-flex items-center gap-1.5 text-[13px] font-semibold tracking-wide text-sc-muted uppercase">
          <FileText size={14} className="text-sc-primary" />
          Nội dung giảng dạy
        </div>
        <h4 className="mt-1 mb-2 text-[17px] font-bold text-sc-ink">{saved.title}</h4>
        <div className="rounded-lg bg-sc-paper/60 p-3 text-[14.5px] leading-relaxed whitespace-pre-line text-sc-ink-2">
          {saved.content}
        </div>
      </Card>

      <Card size="small">
        <SectionTitle>
          <span className="inline-flex items-center gap-1.5">
            <BookOpenCheck size={16} className="text-sc-primary" />
            Bài tập về nhà
          </span>
        </SectionTitle>
        {saved.homework?.trim() ? (
          <div className="rounded-lg bg-sc-paper/60 p-3 text-[14.5px] leading-relaxed whitespace-pre-line text-sc-ink-2">
            {saved.homework}
          </div>
        ) : (
          <span className="text-[14px] text-sc-muted-2">Không giao bài tập về nhà trong buổi này.</span>
        )}
      </Card>

      {saved.attachments.length > 0 && (
        <Card size="small">
          <SectionTitle>Tệp đính kèm ({saved.attachments.length})</SectionTitle>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {saved.attachments.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-2 rounded-lg border border-sc-border-soft bg-sc-paper/45 px-3 py-1.5 text-[14px] font-medium text-sc-ink hover:border-sc-primary hover:text-sc-primary"
                >
                  <Paperclip size={14} className="text-sc-primary" />
                  <span>{attachmentFileName(url)}</span>
                  <ExternalLink size={13} className="text-sc-muted" />
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

interface ManagerSessionDrawerProps {
  classId: string;
  className: string;
  classCancelled?: boolean;
  session: ClassSession | null;
  onClose: () => void;
}

function ManagerSessionBody({
  classId,
  classCancelled,
  session,
}: {
  classId: string;
  classCancelled: boolean;
  session: ClassSession;
}) {
  const detail = useTrainingSession(session.id);
  const note = useSessionNote(session.id);
  const active = detail.data ?? session;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2.5 rounded-xl border border-sc-border-soft bg-sc-paper/60 p-3.5 text-[13.5px] sm:grid-cols-2 lg:grid-cols-4">
        <span className="inline-flex items-center gap-2 text-sc-ink-2">
          <CalendarDays size={15} className="shrink-0 text-sc-primary" />
          <b className="truncate">{formatDayLabel(active.date)}</b>
        </span>
        <span className="inline-flex items-center gap-2 text-sc-ink-2">
          <Clock size={15} className="shrink-0 text-sc-primary" />
          <b>
            {active.startTime}–{active.endTime}
          </b>
        </span>
        <span className="inline-flex items-center gap-2 text-sc-ink-2">
          <MapPin size={15} className="shrink-0 text-sc-primary" />
          <b className="truncate">{active.facility.name}</b>
        </span>
        <span className="inline-flex items-center gap-2 text-sc-ink-2">
          <UserCheck size={15} className="shrink-0 text-sc-primary" />
          <b className="truncate">{active.coach?.fullName ?? 'Chưa phân công HLV'}</b>
        </span>
      </div>

      {active.status === 'CANCELLED' && active.cancelReason && (
        <Alert type="error" showIcon title="Lý do hủy buổi học" description={active.cancelReason} />
      )}

      <Tabs
        defaultActiveKey="roster"
        items={[
          {
            key: 'roster',
            label: 'Điểm danh & đánh giá',
            children: (
              <ManagerAttendancePanel
                key={active.id}
                classId={classId}
                session={active}
                classCancelled={classCancelled}
              />
            ),
          },
          {
            key: 'note',
            label: (
              <span className="inline-flex items-center gap-1.5">
                Ghi chú & bài tập buổi
                {note.data && (
                  <Tag color="success" className="!m-0 !text-[11.5px]">
                    Đã ghi chú
                  </Tag>
                )}
              </span>
            ),
            children: <ManagerSessionNotePanel sessionId={active.id} />,
          },
        ]}
      />
    </div>
  );
}

/** Drawer on `/admin/classes/$classId` for managers to inspect a session and override attendance past the coach lock. */
export function ManagerSessionDrawer({
  classId,
  className,
  classCancelled = false,
  session,
  onClose,
}: ManagerSessionDrawerProps) {
  const phase = session ? sessionPhase(session) : 'UPCOMING';

  return (
    <Drawer
      open={session !== null}
      onClose={onClose}
      destroyOnHidden
      size={940}
      title={
        session ? (
          <div className="flex flex-wrap items-center gap-2">
            <span>
              Buổi {String(session.sessionNumber).padStart(2, '0')} · {className}
            </span>
            {session.status === 'CANCELLED' ? (
              <Tag color="error" className="!m-0">
                Đã hủy
              </Tag>
            ) : (
              <Tag color={SESSION_PHASE_TAG[phase].color} className="!m-0">
                {SESSION_PHASE_TAG[phase].label}
              </Tag>
            )}
            {session.isSubstitute && (
              <Tag color="purple" className="!m-0">
                Dạy thay
              </Tag>
            )}
          </div>
        ) : (
          'Chi tiết buổi học'
        )
      }
    >
      {!session ? <Spin /> : <ManagerSessionBody classId={classId} classCancelled={classCancelled} session={session} />}
    </Drawer>
  );
}
