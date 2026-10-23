import { getRouteApi } from '@tanstack/react-router';
import { Card, Tabs, Tag } from 'antd';
import { ErrorState, PageLoading } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { SportTag } from '~/components/ui/SportTag';
import { useCurrentUser } from '~/features/auth';
import { useClass } from '~/features/classes/hooks/useClasses';
import { classDateRange, classStatusTag, weeklyLines } from '~/features/classes/utils';
import { toApiError } from '~/lib/http-errors';
import { AnnouncementsTab } from './class/AnnouncementsTab';
import { ClassPlanTab } from './class/ClassPlanTab';
import { RosterTab } from './class/RosterTab';
import { SessionsTab } from './class/SessionsTab';

const routeApi = getRouteApi('/_authenticated/_coach/coach/classes/$classId');

/** `/coach/classes/{id}`: sessions, students, the class plan and announcements of a class the coach teaches. */
export function CoachClassPage() {
  const { classId } = routeApi.useParams();
  const user = useCurrentUser();
  const detail = useClass(classId);

  if (detail.isPending) return <PageLoading />;
  if (detail.isError) {
    const apiError = toApiError(detail.error);
    return (
      <ErrorState
        message={apiError.status === 404 ? 'Không tìm thấy lớp học.' : apiError.message}
        onRetry={apiError.status ? undefined : () => void detail.refetch()}
      />
    );
  }

  const gymClass = detail.data;
  const mine = gymClass.coach?.id === user.id;
  const status = classStatusTag(gymClass);

  return (
    <>
      <PageHeader
        title={gymClass.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <SportTag name={gymClass.course.sport.name} />
            <Tag color={status.color} className="!m-0">
              {status.label}
            </Tag>
            {weeklyLines(gymClass.weeklySchedule).join(', ')} · {classDateRange(gymClass)} · {gymClass.facility.name} ·{' '}
            {gymClass.enrolledCount}/{gymClass.maxStudents} học viên
          </span>
        }
        back={{ to: '/coach/classes', label: 'Lớp phụ trách' }}
      />
      <Card>
        <Tabs
          items={[
            { key: 'sessions', label: 'Buổi học', children: <SessionsTab gymClass={gymClass} /> },
            {
              key: 'students',
              label: 'Học viên',
              children: <RosterTab classId={classId} sessions={gymClass.sessions} readOnly={!mine} />,
            },
            { key: 'plan', label: 'Kế hoạch', children: <ClassPlanTab classId={classId} readOnly={!mine} /> },
            {
              key: 'announcements',
              label: 'Thông báo',
              children: <AnnouncementsTab classId={classId} canSend={mine} />,
            },
          ]}
        />
      </Card>
    </>
  );
}
