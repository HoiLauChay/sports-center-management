import { getRouteApi, Link } from '@tanstack/react-router';
import { Alert, Button, Card, Table, Tag, type TableColumnsType } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { InfoGrid } from '~/components/data/InfoGrid';
import { ErrorState, PageLoading } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { useCurrentUser } from '~/features/auth';
import { AddToCartButton } from '~/features/checkout';
import { useQuote } from '~/features/checkout/hooks/useCart';
import { formatDate, formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { formatDayLabel } from '~/lib/time';
import { useClass } from '../hooks/useClasses';
import type { ClassSession } from '../types';
import { weeklyText } from '../utils';

const routeApi = getRouteApi('/_authenticated/_member/classes/$classId');

const sessionColumns: TableColumnsType<ClassSession> = [
  { title: 'Buổi', dataIndex: 'sessionNumber', width: 70 },
  {
    title: 'Ngày',
    dataIndex: 'date',
    render: (date: string) => <span className="whitespace-nowrap">{formatDayLabel(date)}</span>,
  },
  { title: 'Giờ', render: (_, session) => `${session.startTime}–${session.endTime}` },
  { title: 'Cơ sở', dataIndex: ['facility', 'name'] },
  {
    title: 'Trạng thái',
    dataIndex: 'status',
    render: (status: ClassSession['status']) =>
      status === 'SCHEDULED' ? (
        <Tag className="!m-0">Dự kiến</Tag>
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
  const quote = useQuote({ user, items: [selection], enabled: Boolean(detail.data) });
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
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
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
                    item.startDate && item.endDate
                      ? `${formatDate(item.startDate)} – ${formatDate(item.endDate)}`
                      : '—',
                },
                { label: 'Sĩ số', value: `${item.enrolledCount}/${item.maxStudents} (còn ${seatsLeft} chỗ)` },
              ]}
            />
          </Card>
          <Card>
            <SectionTitle>Lịch các buổi học</SectionTitle>
            <Table<ClassSession>
              rowKey="id"
              size="small"
              columns={sessionColumns}
              dataSource={item.sessions}
              pagination={false}
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </div>
        <Card className="xl:sticky xl:top-20">
          <SectionTitle>Đăng ký</SectionTitle>
          <div className="text-[14px]">
            <div className="flex justify-between border-b border-dashed border-sc-border py-1.5">
              <span>Học phí</span>
              <span className="tabular-nums">{formatVND(item.course.price)}</span>
            </div>
            {line && line.membershipDiscount > 0 && (
              <div className="flex justify-between border-b border-dashed border-sc-border py-1.5 text-sc-success">
                <span>Ưu đãi gói thành viên</span>
                <span className="tabular-nums">−{formatVND(line.membershipDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 text-[18px] font-extrabold">
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
          <p className="mt-3 mb-0 text-xs text-sc-muted-2">
            Chỗ chỉ được giữ khi thanh toán. Hủy trước buổi đầu tiên đủ hạn sẽ được hoàn tiền về ví.
          </p>
        </Card>
      </div>
    </>
  );
}
