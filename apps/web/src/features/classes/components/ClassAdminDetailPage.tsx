import { getRouteApi, useRouter } from '@tanstack/react-router';
import { Alert, Button, Card, Switch, Table, Tabs, Tag, Tooltip, type TableColumnsType } from 'antd';
import {
  Ban,
  Banknote,
  CalendarClock,
  CalendarDays,
  Check,
  Pencil,
  TriangleAlert,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { ErrorState, PageLoading } from '~/components/feedback/States';
import { MappedTag } from '~/components/ui/MappedTag';
import { PageHeader } from '~/components/ui/PageHeader';
import { StatCard } from '~/components/ui/StatCard';
import { useConfirm } from '~/hooks/useConfirm';
import { formatDate, formatDateTime, formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { formatDayLabel, isPast, WEEK_ORDER } from '~/lib/time';
import {
  useApproveClass,
  useAssignCoach,
  useClassAdmin,
  useRejectClass,
  useSetMinStudentsOverride,
} from '../hooks/useClassAdmin';
import type { ClassAdminDetail, ClassSession, ClassStudent, CoachRegistration } from '../types';
import { classAdminActions, classStatusTag, REGISTRATION_TAG } from '../utils';
import {
  AssignCoachModal,
  CancelClassModal,
  CancelSessionModal,
  EditClassModal,
  EditSessionModal,
} from './ClassAdminModals';

const routeApi = getRouteApi('/_authenticated/_manager/admin/classes/$classId');

type ModalState =
  null | 'edit' | 'cancel' | 'assign' | { kind: 'edit-session' | 'cancel-session'; session: ClassSession };

const SOURCE_LABEL: Record<CoachRegistration['source'], string> = {
  COACH_REGISTERED: 'HLV đăng ký',
  MANAGER_ASSIGNED: 'Manager phân công',
};

const DAY_NAME = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'] as const;

const tableFrame = 'overflow-hidden rounded-lg border border-solid border-sc-border-soft';

function Initial({ name }: { name: string }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sc-primary-soft text-[13px] font-semibold text-sc-primary">
      {name.trim().split(/\s+/).at(-1)?.[0]?.toUpperCase()}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="w-40 shrink-0 text-sc-muted">{label}:</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

/**
 * `/admin/classes/{id}`: figures, coach, class info and tabs for students, sessions, coach registrations and revenue.
 * Every button is shown only when the class state allows it (BR_2.10).
 */
export function ClassAdminDetailPage() {
  const { classId } = routeApi.useParams();
  const router = useRouter();
  const detail = useClassAdmin(classId);
  const confirm = useConfirm();
  const approve = useApproveClass(classId);
  const reject = useRejectClass(classId);
  const assign = useAssignCoach(classId);
  const override = useSetMinStudentsOverride(classId);
  const [modal, setModal] = useState<ModalState>(null);
  const [tab, setTab] = useState<string>();

  if (detail.isPending) return <PageLoading />;
  if (detail.isError) {
    const apiError = toApiError(detail.error);
    return (
      <ErrorState
        message={apiError.status === 404 ? 'Không tìm thấy lớp học.' : apiError.message}
        onRetry={apiError.status === 404 ? undefined : () => void detail.refetch()}
      />
    );
  }

  const item: ClassAdminDetail = detail.data;
  const can = classAdminActions(item);
  const status = classStatusTag(item);
  const liveSessions = item.sessions.filter((session) => session.status === 'SCHEDULED');
  const taught = liveSessions.filter((session) => isPast(session.date, session.startTime)).length;
  const cancelledSessions = item.sessions.length - liveSessions.length;
  const pendingRegistrations = item.coachRegistrations.filter((entry) => entry.status === 'PENDING').length;
  const cancelledEnrollments = item.students.filter((student) => student.status === 'CANCELLED').length;
  const fill = Math.round((item.enrolledCount / item.maxStudents) * 100);
  const closeModal = () => setModal(null);
  const sessionModal = typeof modal === 'object' && modal ? modal : null;
  const needsCoach = item.status === 'PENDING_APPROVAL' && !item.coach;

  const askReject = () =>
    confirm({
      title: 'Từ chối mở lớp?',
      content: 'Lớp trở về trạng thái nháp, HLV hiện tại bị gỡ và nhận thông báo.',
      okText: 'Từ chối',
      onOk: () => reject.mutateAsync().catch(() => undefined),
    });

  const askApprove = () =>
    confirm({
      title: `Duyệt mở lớp ${item.name}?`,
      content: 'Lớp chuyển sang đang mở và bắt đầu nhận đăng ký.',
      okText: 'Duyệt mở lớp',
      danger: false,
      onOk: () => approve.mutateAsync().catch(() => undefined),
    });

  const askPick = (registration: CoachRegistration) =>
    confirm({
      title: `Chọn ${registration.coach.fullName} dạy lớp này?`,
      content: 'Các đăng ký còn chờ của lớp sẽ bị từ chối. Lớp chuyển sang chờ duyệt.',
      okText: 'Chọn HLV',
      danger: false,
      onOk: () => assign.mutateAsync({ registrationId: registration.id }).catch(() => undefined),
    });

  const studentColumns: TableColumnsType<ClassStudent> = [
    {
      title: 'Học viên',
      key: 'name',
      render: (_, student) => (
        <div className="flex items-center gap-2">
          <Initial name={student.fullName} />
          <b>{student.fullName}</b>
        </div>
      ),
    },
    {
      title: 'Đăng ký lúc',
      dataIndex: 'enrolledAt',
      render: (value: string | null) => (value ? formatDateTime(value) : <span className="text-sc-muted-2">—</span>),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (value: ClassStudent['status']) =>
        value === 'ENROLLED' ? <Tag color="success">Đang học</Tag> : <Tag>Đã hủy</Tag>,
    },
    {
      title: 'Đã trả',
      dataIndex: 'paidAmount',
      align: 'right',
      render: (value: number) => <span className="tabular-nums">{formatVND(value)}</span>,
    },
  ];

  const revenueColumns: TableColumnsType<ClassStudent> = [
    { title: 'Học viên', dataIndex: 'fullName', render: (name: string) => <b>{name}</b> },
    {
      title: 'Đã trả',
      dataIndex: 'paidAmount',
      align: 'right',
      render: (value: number) => <span className="tabular-nums">{formatVND(value)}</span>,
    },
    {
      title: 'Đã hoàn',
      dataIndex: 'refundedAmount',
      align: 'right',
      render: (value: number) => <span className="tabular-nums">{value > 0 ? `−${formatVND(value)}` : '—'}</span>,
    },
    {
      title: 'Còn lại',
      key: 'rest',
      align: 'right',
      render: (_, student) => <b className="tabular-nums">{formatVND(student.paidAmount - student.refundedAmount)}</b>,
    },
  ];

  const registrationColumns: TableColumnsType<CoachRegistration> = [
    {
      title: 'HLV',
      key: 'coach',
      render: (_, registration) => (
        <div className="flex min-w-48 items-center gap-2">
          <Initial name={registration.coach.fullName} />
          <div className="flex flex-col">
            <b>{registration.coach.fullName}</b>
            <span className="text-[11.5px] text-sc-muted">{SOURCE_LABEL[registration.source]}</span>
          </div>
        </div>
      ),
    },
    { title: 'Đăng ký lúc', dataIndex: 'createdAt', render: (value: string) => formatDateTime(value) },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (value: CoachRegistration['status']) => <MappedTag value={value} map={REGISTRATION_TAG} />,
    },
    { title: 'Lớp đang dạy', dataIndex: 'activeClasses', align: 'center', render: (value?: number) => value ?? 0 },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, registration) =>
        can.assignCoach && registration.status === 'PENDING' ? (
          <Button size="small" type="primary" loading={assign.isPending} onClick={() => askPick(registration)}>
            Chọn HLV này
          </Button>
        ) : null,
    },
  ];

  const sessionColumns: TableColumnsType<ClassSession> = [
    { title: 'Buổi', dataIndex: 'sessionNumber', width: 70 },
    {
      title: 'Ngày',
      dataIndex: 'date',
      render: (date: string) => <span className="whitespace-nowrap">{formatDayLabel(date)}</span>,
    },
    { title: 'Giờ', render: (_, session) => `${session.startTime}–${session.endTime}` },
    { title: 'Sân / phòng', dataIndex: ['facility', 'name'] },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_, session) =>
        session.status === 'CANCELLED' ? (
          <Tooltip title={session.cancelReason}>
            <Tag color="error">Đã hủy</Tag>
          </Tooltip>
        ) : isPast(session.date, session.startTime) ? (
          <Tag>Đã diễn ra</Tag>
        ) : (
          <Tag color="processing">Sắp tới</Tag>
        ),
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, session) => {
        if (!can.sessions || session.status !== 'SCHEDULED' || isPast(session.date, session.startTime)) return null;
        const last = liveSessions.length <= 1;
        return (
          <div className="flex justify-end gap-1.5">
            <Button
              size="small"
              icon={<CalendarClock size={14} />}
              onClick={() => setModal({ kind: 'edit-session', session })}
            >
              Sửa / dời
            </Button>
            <Tooltip title={last ? 'Buổi cuối cùng còn lại, hãy hủy cả lớp' : undefined}>
              <Button
                size="small"
                danger
                disabled={last}
                icon={<Ban size={14} />}
                onClick={() => setModal({ kind: 'cancel-session', session })}
              >
                Hủy buổi
              </Button>
            </Tooltip>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title={item.name}
        description={`${item.course.name} · ${item.facility.name}${
          item.startDate && item.endDate ? ` · ${formatDate(item.startDate)} → ${formatDate(item.endDate)}` : ''
        } · ${liveSessions.length}/${item.course.totalSessions} buổi`}
        extra={
          <div className="flex flex-wrap items-center gap-2">
            <Tag color={status.color}>{status.label}</Tag>
            {can.approve && (
              <Button type="primary" loading={approve.isPending} icon={<Check size={16} />} onClick={askApprove}>
                Duyệt mở lớp
              </Button>
            )}
            {can.reject && (
              <Button loading={reject.isPending} icon={<X size={16} />} onClick={askReject}>
                Từ chối
              </Button>
            )}
            {can.edit && (
              <Button icon={<Pencil size={16} />} onClick={() => setModal('edit')}>
                Sửa thông tin
              </Button>
            )}
            {can.cancel && (
              <Button danger onClick={() => setModal('cancel')}>
                Hủy lớp
              </Button>
            )}
            <Button onClick={() => router.history.back()}>Quay lại</Button>
          </div>
        }
      />

      {item.status === 'CANCELLED' && (
        <Alert
          type="error"
          showIcon
          className="!mb-4"
          title="Lớp đã bị hủy"
          description={item.cancelReason ?? undefined}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label="Sĩ số"
          value={`${item.enrolledCount}/${item.maxStudents}`}
          hint={`Tối thiểu ${item.minStudents} · lấp đầy ${fill}%`}
        />
        <StatCard
          icon={CalendarDays}
          label="Buổi đã dạy"
          value={`${taught}/${item.course.totalSessions}`}
          hint={`${cancelledSessions} buổi hủy`}
        />
        <StatCard
          icon={UserCheck}
          label="HLV"
          value={item.coach?.fullName ?? '—'}
          hint={`${pendingRegistrations} đăng ký chờ`}
        />
        <StatCard
          icon={Banknote}
          label="Doanh thu lớp"
          value={formatVND(item.revenue.total)}
          hint={`${item.revenue.lines} dòng · học phí ${formatVND(item.course.price)}`}
        />
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,462px)_minmax(0,1fr)]">
        <Card
          title="Huấn luyện viên hiện tại"
          styles={{ header: { minHeight: 52 } }}
          extra={
            can.assignCoach && (
              <Button type="link" className="!p-0 !font-medium" onClick={() => setModal('assign')}>
                {item.coach ? 'Đổi HLV' : 'Phân công'}
              </Button>
            )
          }
        >
          {item.coach ? (
            <div className="flex items-center gap-3">
              <Initial name={item.coach.fullName} />
              <div className="flex flex-col">
                <b>{item.coach.fullName}</b>
                <span className="text-[12.5px] text-sc-muted">{item.course.sport.name}</span>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 rounded-lg border border-solid border-[#ffe58f] bg-[#fffbe6] px-3 py-2.5 text-[13px]">
              <TriangleAlert size={15} className="mt-0.5 shrink-0 text-[#d48806]" />
              <div className="flex flex-col gap-1">
                <b>Chưa có HLV — lớp chỉ OPEN khi có đúng 1 HLV</b>
                <span className="text-[12.5px] text-sc-ink-2">
                  {item.coachRegistrations.length > 0
                    ? 'Có HLV đăng ký, xem tab HLV để chọn.'
                    : 'Chưa có HLV đăng ký, hãy phân công trực tiếp.'}
                </span>
              </div>
            </div>
          )}
        </Card>

        <Card title="Thông tin lớp" styles={{ header: { minHeight: 52 } }}>
          <div className="flex flex-col gap-2">
            <Row label="Khóa học">
              {item.course.name} · <Tag color="success">{item.course.sport.name}</Tag>
            </Row>
            <Row label="Học phí">{formatVND(item.course.price)}</Row>
            <Row label="Lịch tuần">
              {WEEK_ORDER.map((day) => item.weeklySchedule.find((slot) => slot.dayOfWeek === day))
                .filter((slot) => slot !== undefined)
                .map((slot) => (
                  <Tag key={slot.dayOfWeek} color="processing">
                    {DAY_NAME[slot.dayOfWeek]} {slot.startTime}–{slot.endTime}
                  </Tag>
                ))}
            </Row>
            <Row label="Đã hủy đăng ký">{cancelledEnrollments} lượt</Row>
            <Row label="Sĩ số">
              {item.minStudents} – {item.maxStudents}
            </Row>
            <Row label="Override sĩ số tối thiểu">
              <Switch
                size="small"
                checked={item.minStudentsOverride}
                disabled={!can.override}
                loading={override.isPending}
                onChange={(checked) => override.mutate(checked)}
              />
              <span className="text-[12px] text-sc-muted-2">bật để không tự hủy khi thiếu sĩ số</span>
            </Row>
          </div>
        </Card>
      </div>

      <Card className="!mt-4">
        <Tabs
          activeKey={tab ?? (needsCoach ? 'coaches' : 'students')}
          onChange={setTab}
          items={[
            {
              key: 'students',
              label: `Học viên (${item.enrolledCount})`,
              children: (
                <Table<ClassStudent>
                  rowKey="id"
                  size="middle"
                  columns={studentColumns}
                  dataSource={item.students}
                  pagination={{ pageSize: 10, hideOnSinglePage: true }}
                  scroll={{ x: 'max-content' }}
                  className={tableFrame}
                  locale={{ emptyText: 'Chưa có học viên đăng ký' }}
                />
              ),
            },
            {
              key: 'sessions',
              label: `Buổi học (${item.sessions.length})`,
              children: (
                <Table<ClassSession>
                  rowKey="id"
                  size="middle"
                  columns={sessionColumns}
                  dataSource={item.sessions}
                  pagination={{ pageSize: 10, hideOnSinglePage: true }}
                  scroll={{ x: 'max-content' }}
                  className={tableFrame}
                />
              ),
            },
            {
              key: 'coaches',
              label: `HLV đăng ký (${item.coachRegistrations.length})`,
              children: (
                <Table<CoachRegistration>
                  rowKey="id"
                  size="middle"
                  columns={registrationColumns}
                  dataSource={item.coachRegistrations}
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                  className={tableFrame}
                  locale={{ emptyText: 'Chưa có HLV nào đăng ký dạy lớp này' }}
                />
              ),
            },
            {
              key: 'revenue',
              label: `Doanh thu (${item.revenue.lines})`,
              children: (
                <Table<ClassStudent>
                  rowKey="id"
                  size="middle"
                  columns={revenueColumns}
                  dataSource={item.students.filter((student) => student.paidAmount > 0)}
                  pagination={{ pageSize: 10, hideOnSinglePage: true }}
                  scroll={{ x: 'max-content' }}
                  className={tableFrame}
                  locale={{ emptyText: 'Chưa có khoản thu nào' }}
                />
              ),
            },
          ]}
        />
      </Card>

      <EditClassModal open={modal === 'edit'} item={item} onClose={closeModal} />
      <CancelClassModal open={modal === 'cancel'} item={item} onClose={closeModal} />
      <AssignCoachModal open={modal === 'assign'} item={item} onClose={closeModal} />
      <EditSessionModal
        open={sessionModal?.kind === 'edit-session'}
        item={item}
        session={sessionModal?.session ?? null}
        onClose={closeModal}
      />
      <CancelSessionModal
        open={sessionModal?.kind === 'cancel-session'}
        item={item}
        session={sessionModal?.session ?? null}
        onClose={closeModal}
      />
    </>
  );
}
