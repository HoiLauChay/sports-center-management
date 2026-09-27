import type { Account } from '@sports-center/shared';
import { Avatar, Button, Card, Col, Result, Row } from 'antd';
import {
  ArrowLeft,
  Award,
  BriefcaseBusiness,
  Cake,
  CalendarDays,
  HeartPulse,
  Mail,
  MapPin,
  NotebookPen,
  Phone,
  PhoneCall,
  StickyNote,
  Target,
  VenusAndMars,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { InfoGrid, type InfoItem } from '~/components/data/InfoGrid';
import { ErrorState, PageLoading } from '~/components/feedback/States';
import { RoleTag } from '~/components/ui/RoleTag';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { GENDER_LABEL, getCoachProfile, getMemberProfile, getStaffProfile } from '~/lib/account';
import { formatDate, initialsOf } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { ROLE_COLOR } from '~/styles/antd-theme';
import { useUserDetail } from '../hooks/useUserDetail';
import { StatusTag } from './StatusTag';

function roleSection(user: Account): { title: string; items: InfoItem[] } | null {
  const member = getMemberProfile(user);
  if (member) {
    return {
      title: 'Hồ sơ hội viên',
      items: [
        { label: 'Liên hệ khẩn cấp', value: member.emergencyContact, icon: PhoneCall, full: true },
        { label: 'Mục tiêu tập luyện', value: member.fitnessGoals, icon: Target, full: true },
        { label: 'Ghi chú sức khỏe', value: member.healthNotes, icon: HeartPulse, full: true },
      ],
    };
  }
  const coach = getCoachProfile(user);
  if (coach) {
    return {
      title: 'Hồ sơ huấn luyện viên',
      items: [
        { label: 'Giới thiệu', value: coach.bio, icon: NotebookPen, full: true },
        { label: 'Kinh nghiệm', value: coach.experience, icon: BriefcaseBusiness, full: true },
        { label: 'Chứng chỉ', value: coach.certifications, icon: Award, full: true },
      ],
    };
  }
  const staff = getStaffProfile(user);
  if (staff) {
    return {
      title: 'Hồ sơ nhân sự',
      items: [{ label: 'Ghi chú nhân sự', value: staff.staffNotes, icon: StickyNote, full: true }],
    };
  }
  return null;
}

function UserSummary({ user }: { user: Account }) {
  const roleColor = ROLE_COLOR[user.role];
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar
          src={user.avatarUrl ?? undefined}
          size={72}
          className="shrink-0 !text-2xl !font-bold"
          style={{ background: `color-mix(in srgb, ${roleColor} 14%, white)`, color: roleColor }}
        >
          {initialsOf(user.fullName)}
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 font-display text-[26px] leading-tight font-extrabold uppercase [overflow-wrap:anywhere]">
            {user.fullName}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-sc-muted">
            <RoleTag role={user.role} />
            <StatusTag status={user.status} />
            <span className="inline-flex items-center gap-1.5">
              <Mail size={14} />
              {user.email}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={14} />
              Tham gia {formatDate(user.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

interface UserDetailViewProps {
  user: Account;
  aside?: ReactNode;
}

export function UserDetailView({ user, aside }: UserDetailViewProps) {
  const section = roleSection(user);

  return (
    <div className="flex flex-col gap-4">
      <UserSummary user={user} />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={aside ? 16 : 24}>
          <Card>
            <SectionTitle>Thông tin cá nhân</SectionTitle>
            <InfoGrid
              items={[
                { label: 'Email', value: user.email, icon: Mail },
                { label: 'Số điện thoại', value: user.phone, icon: Phone },
                { label: 'Ngày sinh', value: user.dateOfBirth && formatDate(user.dateOfBirth), icon: Cake },
                { label: 'Giới tính', value: user.gender && GENDER_LABEL[user.gender], icon: VenusAndMars },
                { label: 'Địa chỉ', value: user.address, icon: MapPin, full: true },
              ]}
            />
            {section && (
              <div className="mt-8">
                <SectionTitle>{section.title}</SectionTitle>
                <InfoGrid items={section.items} />
              </div>
            )}
          </Card>
        </Col>
        {aside && (
          <Col xs={24} lg={8}>
            <div className="flex flex-col gap-4">{aside}</div>
          </Col>
        )}
      </Row>
    </div>
  );
}

interface UserDetailLoaderProps {
  id: string;
  backLabel: string;
  onBack: () => void;
  aside?: (user: Account) => ReactNode;
}

export function UserDetailLoader({ id, backLabel, onBack, aside }: UserDetailLoaderProps) {
  const { data: user, isPending, isError, error, notFound, refetch } = useUserDetail(id);

  const back = (
    <Button type="text" icon={<ArrowLeft size={16} />} onClick={onBack} className="-ml-2 mb-3 !text-sc-muted">
      {backLabel}
    </Button>
  );

  if (isPending) return <PageLoading />;
  if (notFound) {
    return (
      <Card>
        <Result
          status="404"
          title="Không tìm thấy người dùng"
          subTitle="Tài khoản này không tồn tại hoặc bạn không có quyền xem."
          extra={
            <Button type="primary" onClick={onBack}>
              {backLabel}
            </Button>
          }
        />
      </Card>
    );
  }
  if (isError || !user) {
    return (
      <>
        {back}
        <Card>
          <ErrorState message={toApiError(error).message} onRetry={() => void refetch()} />
        </Card>
      </>
    );
  }

  return (
    <>
      {back}
      <UserDetailView user={user} aside={aside?.(user)} />
    </>
  );
}
