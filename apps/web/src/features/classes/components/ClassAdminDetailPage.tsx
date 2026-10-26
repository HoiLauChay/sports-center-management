import { getRouteApi, useRouter } from '@tanstack/react-router';
import { Alert, Button, Card, Table, Tabs, Tag, Tooltip, type TableColumnsType } from 'antd';
import { Banknote, CalendarDays, Check, Pencil, TriangleAlert, UserCheck, Users, X } from 'lucide-react';
import { useState } from 'react';
import { RowActions } from '~/components/data/RowActions';
import { ErrorState, PageLoading } from '~/components/feedback/States';
import { MappedTag } from '~/components/ui/MappedTag';
import { MoneyFigure } from '~/components/ui/MoneyFigure';
import { PageHeader } from '~/components/ui/PageHeader';
import { SportTag } from '~/components/ui/SportTag';
import { StatCard } from '~/components/ui/StatCard';
import { RosterTab } from '~/features/training/components/class/RosterTab';
import { useConfirm } from '~/hooks/useConfirm';
import { formatDate, formatDateTime, formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { formatDayLabel, isPast, WEEK_ORDER } from '~/lib/time';
import { useApproveClass, useAssignCoach, useClassAdmin, useRejectClass } from '../hooks/useClassAdmin';
import type { ClassAdminDetail, ClassSession, CoachRegistration } from '../types';
import { classAdminActions, classStatusTag, REGISTRATION_TAG } from '../utils';
import { AssignCoachModal, CancelClassModal, EditClassModal } from './ClassAdminModals';
import { ClassStudentsTable } from './ClassStudentsTable';
import { SessionEditModal } from './SessionEditModal';

const routeApi = getRouteApi('/_authenticated/_manager/admin/classes/$classId');

type ModalState = null | 'edit' | 'cancel' | 'assign';

const SOURCE_LABEL: Record<CoachRegistration['source'], string> = {
  COACH_REGISTERED: 'HLV đăng ký',
  MANAGER_ASSIGNED: 'Manager phân công',
};

const DAY_NAME = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'] as const;

function Initial({ name }: { name: string }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sc-primary-soft text-[14.5px] font-semibold text-sc-primary">
      {name.trim().split(/\s+/).at(-1)?.[0]?.toUpperCase()}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[14.5px]">
      <span className="w-40 shrink-0 text-sc-muted">{label}:</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

/**
 * `/admin/classes/{id}`: figures, coach, class info and tabs for sessions, students and coach registrations.
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
  const [modal, setModal] = useState<ModalState>(null);
  const [tab, setTab] = useState<string>();
  const [editing, setEditing] = useState<ClassSession | null>(null);

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
  const closeModal = () => setModal(null);
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

  const registrationColumns: TableColumnsType<CoachRegistration> = [
    {
      title: 'HLV',
      key: 'coach',
      render: (_, registration) => (
        <div className="flex min-w-48 items-center gap-2">
          <Initial name={registration.coach.fullName} />
          <div className="flex flex-col">
            <span className="font-semibold">{registration.coach.fullName}</span>
            <span className="text-[14.5px] text-sc-muted">{SOURCE_LABEL[registration.source]}</span>
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
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'right',
      render: (_, registration) => (
        <RowActions
          label={`Thao tác với đăng ký của ${registration.coach.fullName}`}
          actions={
            can.assignCoach && registration.status === 'PENDING'
              ? [
                  {
                    key: 'pick',
                    label: 'Chọn HLV này',
                    primary: true,
                    loading: assign.isPending,
                    onClick: () => askPick(registration),
                  },
                ]
              : []
          }
        />
      ),
    },
  ];

  const sessionColumns: TableColumnsType<ClassSession> = [
    {
      title: 'Buổi',
      dataIndex: 'sessionNumber',
      width: 70,
      render: (value: number) => (
        <span className="font-display text-xl font-extrabold text-sc-muted-2">{String(value).padStart(2, '0')}</span>
      ),
    },
    {
      title: 'Ngày',
      dataIndex: 'date',
      render: (date: string) => <span className="whitespace-nowrap">{formatDayLabel(date)}</span>,
    },
    { title: 'Giờ', render: (_, session) => `${session.startTime}–${session.endTime}` },
    { title: 'Sân / phòng', dataIndex: ['facility', 'name'] },
    {
      title: 'HLV',
      key: 'coach',
      render: (_, session) =>
        session.isSubstitute ? (
          <Tag color="purple" className="!m-0">
            Dạy thay: {session.coach?.fullName}
          </Tag>
        ) : (
          <span className="text-sc-muted">{session.coach?.fullName ?? '—'}</span>
        ),
    },
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
      title: 'Thao tác',
      key: 'actions',
      align: 'right',
      render: (_, session) => (
        <RowActions
          label={`Thao tác với buổi ${session.sessionNumber}`}
          actions={
            item.status !== 'CANCELLED' && session.status === 'SCHEDULED' && !isPast(session.date, session.startTime)
              ? [{ key: 'edit', label: 'Sửa', onClick: () => setEditing(session) }]
              : []
          }
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={item.name}
        back={{ to: '/admin/classes', label: 'Danh sách lớp' }}
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
        <StatCard icon={Users} label="Sĩ số" value={`${item.enrolledCount}/${item.maxStudents}`} />
        <StatCard icon={CalendarDays} label="Buổi đã dạy" value={`${taught}/${item.course.totalSessions}`} />
        <StatCard icon={UserCheck} label="HLV" value={item.coach?.fullName ?? '—'} />
        <StatCard icon={Banknote} label="Học phí" value={<MoneyFigure amount={item.course.price} />} />
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
                <span className="text-[13.5px] text-sc-muted">{item.course.sport.name}</span>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 rounded-lg border border-solid border-[#ffe58f] bg-[#fffbe6] px-3 py-2.5 text-[14.5px]">
              <TriangleAlert size={15} className="mt-0.5 shrink-0 text-[#d48806]" />
              <div className="flex flex-col gap-1">
                <b>Chưa có HLV — lớp chỉ OPEN khi có đúng 1 HLV</b>
                <span className="text-[13.5px] text-sc-ink-2">
                  {item.coachRegistrations.length > 0 ? 'Có HLV đăng ký, xem tab HLV để chọn.' : 'Chưa có HLV đăng ký.'}
                </span>
              </div>
            </div>
          )}
        </Card>

        <Card title="Thông tin lớp" styles={{ header: { minHeight: 52 } }}>
          <div className="flex flex-col gap-2">
            <Row label="Khóa học">
              {item.course.name} · <SportTag name={item.course.sport.name} />
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
            <Row label="Sĩ số">
              {item.minStudents} – {item.maxStudents}
            </Row>
          </div>
        </Card>
      </div>

      <Card className="!mt-4">
        <Tabs
          activeKey={tab ?? (needsCoach ? 'coaches' : 'sessions')}
          onChange={setTab}
          items={[
            {
              key: 'sessions',
              label: `Buổi học (${item.sessions.length})`,
              children: (
                <Table<ClassSession>
                  rowKey="id"
                  columns={sessionColumns}
                  dataSource={item.sessions}
                  pagination={{ pageSize: 10, hideOnSinglePage: true }}
                  scroll={{ x: 'max-content' }}
                />
              ),
            },
            {
              key: 'students',
              label: `Học viên (${item.enrolledCount})`,
              children: <ClassStudentsTable classId={item.id} showPayment />,
            },
            {
              key: 'progress',
              label: 'Tiến độ học viên',
              children: <RosterTab classId={item.id} sessions={item.sessions} readOnly />,
            },
            {
              key: 'coaches',
              label: `HLV đăng ký (${item.coachRegistrations.length})`,
              children: (
                <Table<CoachRegistration>
                  rowKey="id"
                  columns={registrationColumns}
                  dataSource={item.coachRegistrations}
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                  locale={{ emptyText: 'Chưa có HLV nào đăng ký dạy lớp này' }}
                />
              ),
            },
          ]}
        />
      </Card>

      <EditClassModal open={modal === 'edit'} item={item} onClose={closeModal} />
      <CancelClassModal open={modal === 'cancel'} item={item} onClose={closeModal} />
      <AssignCoachModal open={modal === 'assign'} item={item} onClose={closeModal} />
      <SessionEditModal item={item} session={editing} onClose={() => setEditing(null)} />
    </>
  );
}
