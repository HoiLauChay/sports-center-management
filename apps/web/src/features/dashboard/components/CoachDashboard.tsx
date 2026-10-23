import type { CoachScheduleItem, ProgressMilestone } from '@sports-center/shared';
import { ATTENDANCE_RULES, PROGRESS_MILESTONES } from '@sports-center/shared';
import { useQueries } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button, Card, Col, List, Row, Tag } from 'antd';
import { CalendarDays, ClipboardCheck, GraduationCap } from 'lucide-react';
import { useMemo } from 'react';
import { EmptyState } from '~/components/feedback/States';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { StatCard } from '~/components/ui/StatCard';
import { useMyClasses } from '~/features/classes/hooks/useCoachClasses';
import { classesService } from '~/features/classes/services/classes.service';
import { useCoachSchedule } from '~/features/schedule';
import { classTrainingService } from '~/features/training/services/classTraining.service';
import {
  attendanceLockReason,
  MILESTONE_LABEL,
  reachedMilestones,
  SESSION_PHASE_TAG,
  sessionPhase,
} from '~/features/training/utils';
import { addDays, formatDayLabel, isPast, todayVN } from '~/lib/time';
import { Greeting } from './RoleDashboards';

const HORIZON_DAYS = 14;
const UPCOMING_LIMIT = 5;

interface Todo {
  key: string;
  title: string;
  detail: string;
  link:
    | { to: '/coach/sessions/$sessionId'; params: { sessionId: string } }
    | { to: '/coach/classes/$classId'; params: { classId: string } };
}

const sessionLine = (item: CoachScheduleItem) =>
  `Buổi ${item.sessionNumber} · ${formatDayLabel(item.date)} · ${item.startTime}–${item.endTime}`;

/** Classes whose reached progress reviews still miss some students (BR_4.9), from each class's sessions and roster. */
function useReviewTodos(): Todo[] {
  const classes = useMyClasses();
  const today = todayVN();
  const live = (classes.data ?? []).filter(
    (item) =>
      item.status === 'OPEN' &&
      (item.derivedStatus === 'ONGOING' ||
        (item.derivedStatus === 'COMPLETED' && (item.endDate ?? '') >= addDays(today, -HORIZON_DAYS))),
  );
  const details = useQueries({
    queries: live.map((item) => ({
      queryKey: ['classes', 'detail', item.id],
      queryFn: () => classesService.get(item.id),
    })),
  });
  const rosters = useQueries({
    queries: live.map((item) => ({
      queryKey: ['training', 'class', item.id, 'roster'],
      queryFn: () => classTrainingService.roster(item.id),
    })),
  });
  return live.flatMap((item, index) => {
    const detail = details[index]?.data;
    const roster = rosters[index]?.data;
    if (!detail || !roster) return [];
    const reached = reachedMilestones(detail.sessions);
    return PROGRESS_MILESTONES.filter((milestone: ProgressMilestone) => reached[milestone]).flatMap((milestone) => {
      const missing = roster.filter((entry) => !entry.reviews.includes(milestone)).length;
      return missing === 0
        ? []
        : [
            {
              key: `${item.id}-${milestone}`,
              title: item.name,
              detail: `${missing} học viên chưa có đánh giá ${MILESTONE_LABEL[milestone].toLowerCase()}`,
              link: { to: '/coach/classes/$classId' as const, params: { classId: item.id } },
            },
          ];
    });
  });
}

/** `/dashboard` for a coach: today's sessions, what is left to do, and the sessions coming up. */
export function CoachDashboard() {
  const today = todayVN();
  const schedule = useCoachSchedule({
    from: addDays(today, -ATTENDANCE_RULES.COACH_EDIT_DAYS),
    to: addDays(today, HORIZON_DAYS),
  });
  const reviewTodos = useReviewTodos();

  const { todaySessions, upcoming, sessionTodos, classCount } = useMemo(() => {
    const items = (schedule.data ?? []).filter((item) => item.status === 'SCHEDULED');
    const ahead = items.filter((item) => item.date > today);
    const todos: Todo[] = items
      .filter((item) => item.date <= today && isPast(item.date, item.endTime))
      .flatMap((item) => {
        const missing = [
          item.attendance.marked < item.attendance.total &&
            `Chưa điểm danh đủ (${item.attendance.marked}/${item.attendance.total})`,
          !item.hasNote && 'Chưa có ghi chú buổi học',
        ].filter(Boolean);
        return missing.length === 0
          ? []
          : [
              {
                key: item.id,
                title: item.class.name,
                detail: `${sessionLine(item)} · ${missing.join(', ')}`,
                link: { to: '/coach/sessions/$sessionId' as const, params: { sessionId: item.id } },
              },
            ];
      });
    return {
      todaySessions: items.filter((item) => item.date === today),
      upcoming: ahead.slice(0, UPCOMING_LIMIT),
      sessionTodos: todos.reverse(),
      classCount: new Set(items.filter((item) => item.date >= today).map((item) => item.classId)).size,
    };
  }, [schedule.data, today]);
  const todos = [...sessionTodos, ...reviewTodos];

  return (
    <>
      <Greeting />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <StatCard
            icon={GraduationCap}
            label="Buổi dạy hôm nay"
            loading={schedule.isPending}
            value={todaySessions.length}
          />
        </Col>
        <Col xs={24} md={8}>
          <StatCard
            icon={ClipboardCheck}
            label="Việc cần làm"
            tone={todos.length > 0 ? 'warning' : 'default'}
            loading={schedule.isPending}
            value={todos.length}
          />
        </Col>
        <Col xs={24} md={8}>
          <StatCard icon={CalendarDays} label="Lớp đang dạy" loading={schedule.isPending} value={classCount} />
        </Col>
      </Row>

      <Card className="!mt-4">
        <SectionTitle>Hôm nay</SectionTitle>
        <List
          loading={schedule.isPending}
          dataSource={todaySessions}
          locale={{ emptyText: <EmptyState title="Hôm nay không có buổi dạy" /> }}
          renderItem={(item) => {
            const phase = sessionPhase(item);
            const tag = SESSION_PHASE_TAG[phase];
            const canMark = attendanceLockReason(item) === null;
            return (
              <List.Item
                className={phase === 'LIVE' ? '!-mx-3 rounded-lg !bg-sc-primary-soft/50 !px-3' : ''}
                actions={[
                  <Link key="open" to="/coach/sessions/$sessionId" params={{ sessionId: item.id }}>
                    <Button type={canMark ? 'primary' : 'default'} size="small">
                      {canMark ? 'Điểm danh' : 'Mở buổi học'}
                    </Button>
                  </Link>,
                ]}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <b>
                      {item.startTime}–{item.endTime} · {item.class.name}
                    </b>
                    <Tag color={tag.color} className="!m-0">
                      {tag.label}
                    </Tag>
                    {item.isSubstitute && (
                      <Tag color="purple" className="!m-0">
                        Dạy thay
                      </Tag>
                    )}
                  </span>
                  <span className="text-[14.5px] text-sc-muted">
                    Buổi {item.sessionNumber} · {item.facility.name}
                    {phase === 'DONE' && ` · Điểm danh ${item.attendance.marked}/${item.attendance.total}`}
                  </span>
                </div>
              </List.Item>
            );
          }}
        />
      </Card>

      <Row gutter={[16, 16]} className="!mt-4">
        <Col xs={24} lg={12}>
          <Card className="h-full">
            <SectionTitle>Việc cần làm</SectionTitle>
            <List
              loading={schedule.isPending}
              dataSource={todos}
              locale={{ emptyText: <EmptyState title="Không còn việc tồn đọng" /> }}
              renderItem={(todo) => (
                <List.Item
                  actions={[
                    <Link key="open" {...todo.link}>
                      <Button size="small">Mở</Button>
                    </Link>,
                  ]}
                >
                  <div className="flex min-w-0 flex-col">
                    <b>{todo.title}</b>
                    <span className="text-[14.5px] text-sc-warning">{todo.detail}</span>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card className="h-full">
            <SectionTitle>Buổi dạy sắp tới</SectionTitle>
            <List
              loading={schedule.isPending}
              dataSource={upcoming}
              locale={{ emptyText: <EmptyState title="Chưa có buổi dạy sắp tới" /> }}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Link key="open" to="/coach/sessions/$sessionId" params={{ sessionId: item.id }}>
                      <Button size="small">Mở</Button>
                    </Link>,
                  ]}
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="flex flex-wrap items-center gap-2">
                      <b>{item.class.name}</b>
                      {item.isSubstitute && (
                        <Tag color="purple" className="!m-0">
                          Dạy thay
                        </Tag>
                      )}
                    </span>
                    <span className="text-[14.5px] text-sc-muted">{sessionLine(item)}</span>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}
