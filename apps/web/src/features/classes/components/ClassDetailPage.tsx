import { getRouteApi, Link } from '@tanstack/react-router';
import { Alert, Button, Card, Table, Tag, type TableColumnsType } from 'antd';
import { ArrowLeft, CircleCheck } from 'lucide-react';
import { InfoGrid } from '~/components/data/InfoGrid';
import { ErrorState, PageLoading } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { useCurrentUser } from '~/features/auth';
import { AddToCartButton } from '~/features/checkout';
import { useQuote } from '~/features/checkout/hooks/useCart';
import { canCancelEnrollment } from '~/features/checkout/refundPolicy';
import { formatDate, formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { formatDayLabel, isPast, todayVN } from '~/lib/time';
import { useClass, useMyEnrollments } from '../hooks/useClasses';
import type { ClassSession } from '../types';
import { weeklyText } from '../utils';
import { enrollmentProgress, useAskCancelEnrollment } from './enrollmentActions';

const routeApi = getRouteApi('/_authenticated/_member/classes/$classId');

const sessionColumns: TableColumnsType<ClassSession> = [
  {
    title: 'Buổi',
    dataIndex: 'sessionNumber',
    width: 56,
    render: (value: number) => (
      <span className="font-display text-xl font-extrabold text-sc-muted-2">{String(value).padStart(2, '0')}</span>
    ),
  },
  {
    title: 'Ngày',
    dataIndex: 'date',
    render: (date: string, session) => (
      <div className="flex flex-col gap-0.5">
        <span className="whitespace-nowrap">{formatDayLabel(date)}</span>
        <span className="text-[13px] text-sc-muted md:hidden">
          {session.startTime}–{session.endTime} · {session.facility.name}
        </span>
      </div>
    ),
  },
  { title: 'Giờ', responsive: ['md'], render: (_, session) => `${session.startTime}–${session.endTime}` },
  { title: 'Cơ sở', responsive: ['md'], dataIndex: ['facility', 'name'] },
  {
    title: 'Trạng thái',
    dataIndex: 'status',
    render: (status: ClassSession['status'], session) =>
      status === 'SCHEDULED' ? (
        <Tag className="!m-0">{isPast(session.date, session.startTime) ? 'Đã diễn ra' : 'Dự kiến'}</Tag>
      ) : (
        <Tag color="error" className="!m-0">
          Đã hủy
        </Tag>
      ),
  },
];

export function ClassDetailPage() {
  const { classId } = routeApi.useParams();
  const user = useCurrentUser();
  const detail = useClass(classId);
  const selection = { type: 'COURSE_ENROLLMENT', classId } as const;
  const enrollments = useMyEnrollments();
  const enrollment = enrollments.data?.find((entry) => entry.class.id === classId && entry.status === 'ENROLLED');
  const { ask: askCancel, cancel } = useAskCancelEnrollment();
  const quote = useQuote({
    user,
    items: [selection],
    enabled: Boolean(detail.data) && enrollments.isSuccess && !enrollment,
  });
  const line = quote.data?.items[0];

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
  const item = detail.data;
  const seatsLeft = item.maxStudents - item.enrolledCount;

  const details = (
    <>
      <Card>
        <SectionTitle>Thông tin lớp</SectionTitle>
        {item.course.description && <p className="mt-0 text-sc-ink-2">{item.course.description}</p>}
        <InfoGrid
          items={[
            { label: 'Huấn luyện viên', value: item.coach?.fullName ?? 'Đang cập nhật' },
            { label: 'Cơ sở', value: item.facility.name },
            { label: 'Lịch học', value: weeklyText(item.weeklySchedule) },
            {
              label: 'Thời gian',
              value:
                item.startDate && item.endDate ? `${formatDate(item.startDate)} – ${formatDate(item.endDate)}` : '—',
            },
            { label: 'Sĩ số', value: `${item.enrolledCount}/${item.maxStudents} (còn ${seatsLeft} chỗ)` },
          ]}
        />
      </Card>
      <Card>
        <SectionTitle>Lịch các buổi học</SectionTitle>
        <Table<ClassSession>
          rowKey="id"
          columns={sessionColumns}
          dataSource={item.sessions}
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </>
  );

  return (
    <>
      <PageHeader
        title={item.name}
        description={`${item.course.sport.name} · ${item.course.totalSessions} buổi`}
        extra={
          <Link to="/classes">
            <Button icon={<ArrowLeft size={16} />}>Danh sách lớp</Button>
          </Link>
        }
      />
      {enrollment ? (
        <div className="flex flex-col gap-4">
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-sc-primary-border bg-sc-primary-soft px-5 py-4">
            <div className="flex min-w-0 items-start gap-3">
              <CircleCheck size={22} className="mt-0.5 shrink-0 text-sc-primary" />
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-[18px] font-extrabold tracking-wide uppercase">
                    Bạn đã đăng ký
                  </span>
                  <Tag color="success" className="!m-0">
                    {item.startDate && todayVN() < item.startDate ? 'Sắp khai giảng' : 'Đang học'}
                  </Tag>
                </div>
                <span className="text-[14px] text-sc-ink-2">
                  <span className="font-semibold text-sc-primary">{enrollmentProgress(enrollment)}</span> · Đã trả{' '}
                  <span className="tabular-nums">{formatVND(enrollment.paidAmount)}</span>
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link to="/schedule">
                <Button type="primary">Xem lịch của tôi</Button>
              </Link>
              <Link to="/training/$classId" params={{ classId }}>
                <Button>Kết quả tập luyện</Button>
              </Link>
              {canCancelEnrollment(item.startDate) && (
                <Button danger type="text" loading={cancel.isPending} onClick={() => askCancel(enrollment)}>
                  Hủy đăng ký
                </Button>
              )}
            </div>
          </section>
          {details}
        </div>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-4">{details}</div>
          <Card className="xl:sticky xl:top-4">
            <SectionTitle>Đăng ký</SectionTitle>
            <div className="text-[14px]">
              <div className="flex justify-between border-b border-sc-border-soft py-2">
                <span>Học phí</span>
                <span className="tabular-nums">{formatVND(item.course.price)}</span>
              </div>
              {line && line.membershipDiscount > 0 && (
                <div className="flex justify-between border-b border-sc-border-soft py-2 text-sc-success">
                  <span>Ưu đãi gói thành viên</span>
                  <span className="tabular-nums">−{formatVND(line.membershipDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2.5 pb-1 text-[18px] font-bold text-sc-ink">
                <span>Tạm tính</span>
                <span className="tabular-nums">{formatVND(line ? line.total : item.course.price)}</span>
              </div>
            </div>
            {line && !line.valid && <Alert type="error" showIcon className="!mb-3" title={line.error?.message} />}
            <AddToCartButton
              block
              size="large"
              selection={selection}
              disabledReason={line && !line.valid ? line.error?.message : undefined}
            />
            {item.startDate && (
              <p className="mt-3 mb-0 text-[13px] text-sc-muted">
                Hủy đăng ký trước ngày khai giảng {formatDate(item.startDate)} được hoàn đủ học phí vào ví.
              </p>
            )}
          </Card>
        </div>
      )}
      {!enrollment && enrollments.isSuccess && (
        <>
          <div className="h-16 md:hidden" />
          <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 flex items-center gap-3 border-t border-t-sc-border-soft bg-white px-4 py-3 shadow-[0_-6px_20px_rgba(20,19,15,0.08)] md:hidden">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[13px] text-sc-muted">Tạm tính</span>
              <span className="font-semibold tabular-nums">{formatVND(line ? line.total : item.course.price)}</span>
            </div>
            <AddToCartButton
              selection={selection}
              disabledReason={line && !line.valid ? line.error?.message : undefined}
            />
          </div>
        </>
      )}
    </>
  );
}
