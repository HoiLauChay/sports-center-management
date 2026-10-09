import { Link, getRouteApi } from '@tanstack/react-router';
import { Button, Card, Tabs, Tag } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { ErrorState, PageLoading } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { toApiError } from '~/lib/http-errors';
import { formatDayLabel, isPast } from '~/lib/time';
import { useTrainingSession } from '../hooks/useTraining';
import { AnnouncementTab } from './AnnouncementTab';
import { AttendanceTab } from './AttendanceTab';
import { EvaluationsTab } from './EvaluationsTab';
import { NoteTab } from './NoteTab';

const routeApi = getRouteApi('/_authenticated/_coach/coach/sessions/$sessionId');

/** `/coach/sessions/{id}`: attendance, session note, evaluations and class announcements for one session. */
export function CoachSessionPage() {
  const { sessionId } = routeApi.useParams();
  const detail = useTrainingSession(sessionId);

  if (detail.isPending) return <PageLoading />;
  if (detail.isError) {
    const apiError = toApiError(detail.error);
    return (
      <ErrorState
        message={
          apiError.status === 404
            ? 'Không tìm thấy buổi học.'
            : apiError.status === 403
              ? 'Bạn không phụ trách lớp của buổi học này.'
              : apiError.message
        }
        onRetry={apiError.status ? undefined : () => void detail.refetch()}
      />
    );
  }

  const session = detail.data;
  const editable = session.status === 'SCHEDULED';
  const upcoming = !isPast(session.date, session.startTime);

  return (
    <>
      <PageHeader
        title={session.class.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            Buổi {session.sessionNumber} · {formatDayLabel(session.date)} · {session.startTime}–{session.endTime} ·{' '}
            {session.facility.name}
            {session.status === 'CANCELLED' ? (
              <Tag color="error" className="!m-0">
                Đã hủy
              </Tag>
            ) : upcoming ? (
              <Tag color="processing" className="!m-0">
                Sắp tới
              </Tag>
            ) : (
              <Tag className="!m-0">Đã diễn ra</Tag>
            )}
            <Tag className="!m-0">{session.class.enrolledCount} học viên</Tag>
          </span>
        }
        extra={
          <Link to="/coach/schedule">
            <Button icon={<ArrowLeft size={16} />}>Lịch dạy</Button>
          </Link>
        }
      />
      <Card>
        <Tabs
          items={[
            {
              key: 'attendance',
              label: 'Điểm danh',
              children: <AttendanceTab sessionId={sessionId} editable={editable} upcoming={upcoming} />,
            },
            { key: 'note', label: 'Ghi chú buổi học', children: <NoteTab sessionId={sessionId} editable={editable} /> },
            {
              key: 'evaluations',
              label: 'Đánh giá học viên',
              children: <EvaluationsTab sessionId={sessionId} editable={editable} />,
            },
            {
              key: 'announce',
              label: 'Thông báo lớp',
              children: <AnnouncementTab classId={session.class.id} />,
            },
          ]}
        />
      </Card>
    </>
  );
}
