import { Link } from '@tanstack/react-router';
import { Button, Card, Col, Row } from 'antd';
import { BadgeCheck, CalendarDays, IdCard, MapPin, School, Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { MoneyFigure } from '~/components/ui/MoneyFigure';
import { PageHeader } from '~/components/ui/PageHeader';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { StatCard } from '~/components/ui/StatCard';
import { useCurrentUser } from '~/features/auth';
import { useMyMemberships } from '~/features/memberships/hooks/useMyMemberships';
import { useMySchedule } from '~/features/schedule';
import { eventsOfMember } from '~/features/schedule/utils';
import { useMyWallet } from '~/features/wallet';
import { addDays, nowVN, parseDate, todayVN } from '~/lib/time';
import { UpcomingList } from './UpcomingList';

const UPCOMING_LIMIT = 5;

const QUICK_LINKS = [
  { to: '/bookings', label: 'Đặt sân', icon: MapPin },
  { to: '/classes', label: 'Đăng ký lớp', icon: School },
  { to: '/wallet/top-up', label: 'Nạp ví', icon: Wallet },
  { to: '/memberships', label: 'Gói thành viên', icon: BadgeCheck },
] as const;
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
  const daysLeft = current ? Math.max(0, parseDate(current.endDate).diff(parseDate(today), 'day')) : 0;

  return (
    <>
      <Greeting />
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <StatCard
            icon={Wallet}
            label="Số dư ví"
            loading={wallet.isPending}
            value={<MoneyFigure amount={wallet.data?.balance ?? 0} />}
          />
        </Col>
        <Col xs={24} md={8}>
          <StatCard
            icon={IdCard}
            label={current ? current.package.name : 'Gói thành viên'}
            loading={memberships.isPending}
            value={current ? `Còn ${daysLeft} ngày` : 'Chưa có gói'}
          />
        </Col>
        <Col xs={24} md={8}>
          <StatCard
            icon={CalendarDays}
            label={`Lịch ${HORIZON_DAYS} ngày tới`}
            loading={schedule.isPending}
            value={events.length}
          />
        </Col>
      </Row>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 rounded-xl border border-sc-border-soft !bg-white px-4 py-3.5 font-semibold !text-sc-ink no-underline [transition:border-color_0.15s] hover:!border-sc-primary-border"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sc-primary-soft text-sc-primary">
              <Icon size={18} />
            </span>
            {label}
          </Link>
        ))}
      </div>
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
