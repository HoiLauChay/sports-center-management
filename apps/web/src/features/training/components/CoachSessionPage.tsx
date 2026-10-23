import { getRouteApi } from '@tanstack/react-router';
import { Card, Tabs, Tag } from 'antd';
import { useEffect, useReducer } from 'react';
import { ErrorState, PageLoading } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { toApiError } from '~/lib/http-errors';
import { formatDayLabel } from '~/lib/time';
import { useTrainingSession } from '../hooks/useTraining';
import { attendanceLockReason, SESSION_PHASE_TAG, sessionPhase } from '../utils';
import { NoteTab } from './NoteTab';
import { SessionRosterTab } from './SessionRosterTab';

const routeApi = getRouteApi('/_authenticated/_coach/coach/sessions/$sessionId');

/** `/coach/sessions/{id}`: attendance with results in one table, and the session note. */
export function CoachSessionPage() {
  const { sessionId } = routeApi.useParams();
  const detail = useTrainingSession(sessionId);
  const [, tick] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (detail.isPending) return <PageLoading />;
  if (detail.isError) {
    const apiError = toApiError(detail.error);
    return (
      <ErrorState
        message={
          apiError.status === 404
            ? 'Không tìm thấy buổi học.'
            : apiError.status === 403
              ? 'Bạn không phụ trách buổi học này.'
              : apiError.message
        }
        onRetry={apiError.status ? undefined : () => void detail.refetch()}
      />
    );
  }

  const session = detail.data;
  const cancelled = session.status === 'CANCELLED';
  const phase = sessionPhase(session);
  const attendanceLock = cancelled ? 'Buổi học đã bị hủy nên không điểm danh được.' : attendanceLockReason(session);

  return (
    <>
      <PageHeader
        title={session.class.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            Buổi {session.sessionNumber} · {formatDayLabel(session.date)} · {session.startTime}–{session.endTime} ·{' '}
            {session.facility.name}
            {cancelled ? (
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
            <Tag className="!m-0">{session.class.enrolledCount} học viên</Tag>
          </span>
        }
        back={{ to: '/coach/schedule', label: 'Lịch dạy' }}
      />
      <Card>
        <Tabs
          items={[
            {
              key: 'roster',
              label: 'Điểm danh & kết quả',
              children: (
                <SessionRosterTab
                  sessionId={sessionId}
                  attendanceLock={attendanceLock}
                  started={!cancelled && phase !== 'UPCOMING'}
                />
              ),
            },
            {
              key: 'note',
              label: 'Ghi chú buổi học',
              children: <NoteTab sessionId={sessionId} editable={!cancelled} />,
            },
          ]}
        />
      </Card>
    </>
  );
}
