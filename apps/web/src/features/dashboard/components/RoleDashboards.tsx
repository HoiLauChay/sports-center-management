import { Link } from '@tanstack/react-router';
import { Button, Card, Col, Row } from 'antd';
import { CalendarDays, GraduationCap, IdCard, Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { PageHeader } from '~/components/ui/PageHeader';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { StatCard } from '~/components/ui/StatCard';
import { useCurrentUser } from '~/features/auth';
import { useMyMemberships } from '~/features/memberships/hooks/useMyMemberships';
import { useCoachSchedule, useMySchedule } from '~/features/schedule';
import { eventsOfCoach, eventsOfMember } from '~/features/schedule/utils';
import { useMyWallet } from '~/features/wallet';
import { formatDate, formatVND } from '~/lib/format';
import { addDays, nowVN, todayVN } from '~/lib/time';
import { UpcomingList } from './UpcomingList';

const UPCOMING_LIMIT = 5;
const HORIZON_DAYS = 14;

/** Events that have not ended yet, soonest first. */
function upcoming<T extends { date: string; endTime: string; cancelled: boolean }>(events: T[]) {
  const now = nowVN().format('YYYY-MM-DD HH:mm');
  return events.filter((event) => !event.cancelled && `${event.date} ${event.endTime}` > now);
}

export function Greeting() {
  const user = useCurrentUser();
  return <PageHeader title={`Xin chào, ${user.fullName}`} />;
}

export function MemberDashboard() {
  const today = todayVN();
  const wallet = useMyWallet({ page: 1, limit: 1 });
  const memberships = useMyMemberships().query;
  const schedule = useMySchedule({ from: today, to: addDays(today, HORIZON_DAYS) });
  const events = useMemo(() => upcoming(eventsOfMember(schedule.data ?? [])), [schedule.data]);
  const current = memberships.data?.current;
  const thisWeek = events.filter((event) => event.date <= addDays(today, 6)).length;

  return (
    <>
      <Greeting />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <StatCard
            icon={Wallet}
            label="Số dư ví"
            loading={wallet.isPending}
            value={formatVND(wallet.data?.balance ?? 0)}
            hint={
              <Link to="/wallet/top-up" className="font-semibold underline underline-offset-2">
                Nạp tiền
              </Link>
            }
          />
        </Col>
        <Col xs={24} md={8}>
          <StatCard
            icon={IdCard}
            label="Gói thành viên"
            loading={memberships.isPending}
            value={
              <span className="text-[clamp(18px,2vw,24px)]">{current ? current.package.name : 'Chưa có gói'}</span>
            }
            hint={
              current ? (
                `Hết hạn ${formatDate(current.endDate)}`
              ) : (
                <Link to="/memberships" className="font-semibold underline underline-offset-2">
                  Xem các gói
                </Link>
              )
            }
          />
        </Col>
        <Col xs={24} md={8}>
          <StatCard
            icon={CalendarDays}
            label="Lịch trong 7 ngày tới"
            loading={schedule.isPending}
            value={thisWeek}
            hint={
              <Link to="/schedule" className="font-semibold underline underline-offset-2">
                Xem lịch của tôi
              </Link>
            }
          />
        </Col>
      </Row>
      <Card className="!mt-4">
        <SectionTitle>Lịch sắp tới</SectionTitle>
        <UpcomingList
          events={events.slice(0, UPCOMING_LIMIT)}
          loading={schedule.isPending}
          empty={
            <div className="flex justify-center gap-2">
              <Link to="/bookings">
                <Button type="primary">Đặt sân</Button>
              </Link>
              <Link to="/classes">
                <Button>Xem lớp học</Button>
              </Link>
            </div>
          }
        />
      </Card>
    </>
  );
}

export function CoachDashboard() {
  const today = todayVN();
  const schedule = useCoachSchedule({ from: today, to: addDays(today, HORIZON_DAYS) });
  const events = useMemo(() => upcoming(eventsOfCoach(schedule.data ?? [])), [schedule.data]);
  const todayCount = events.filter((event) => event.date === today).length;
  const classCount = new Set(events.map((event) => event.classId)).size;

  return (
    <>
      <Greeting />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <StatCard icon={GraduationCap} label="Buổi dạy hôm nay" loading={schedule.isPending} value={todayCount} />
        </Col>
        <Col xs={24} md={8}>
          <StatCard
            icon={CalendarDays}
            label="Buổi dạy 14 ngày tới"
            loading={schedule.isPending}
            value={events.length}
            hint={
              <Link to="/coach/schedule" className="font-semibold underline underline-offset-2">
                Xem lịch dạy
              </Link>
            }
          />
        </Col>
        <Col xs={24} md={8}>
          <StatCard icon={IdCard} label="Lớp đang phụ trách" loading={schedule.isPending} value={classCount} />
        </Col>
      </Row>
      <Card className="!mt-4">
        <SectionTitle>Buổi dạy sắp tới</SectionTitle>
        <UpcomingList
          events={events.slice(0, UPCOMING_LIMIT)}
          loading={schedule.isPending}
          empty={null}
          action={(event) =>
            event.sessionId ? (
              <Link key="open" to="/coach/sessions/$sessionId" params={{ sessionId: event.sessionId }}>
                <Button size="small">Mở buổi học</Button>
              </Link>
            ) : null
          }
        />
      </Card>
    </>
  );
}
