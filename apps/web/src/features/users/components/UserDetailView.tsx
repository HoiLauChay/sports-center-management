import type { Account } from '@sports-center/shared';
import { Avatar, Button, Card, Col, Result, Row, Tag } from 'antd';
import { Cake, CalendarDays, ChevronLeft, Mail, MapPin, Phone, VenusAndMars } from 'lucide-react';
import type { ReactNode } from 'react';
import { AccountRoleSection } from '~/components/data/AccountRoleSection';
import { InfoGrid } from '~/components/data/InfoGrid';
import { ErrorState, PageLoading } from '~/components/feedback/States';
import { RoleTag } from '~/components/ui/RoleTag';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { GENDER_LABEL } from '~/lib/account';
import { formatDate, initialsOf } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { ROLE_COLOR } from '~/styles/antd-theme';
import { useUserDetail } from '../hooks/useUserDetail';
import { StatusTag } from './StatusTag';

function UserSummary({ user, actions }: { user: Account; actions?: ReactNode }) {
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
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[14.5px] text-sc-muted">
            {user.roles.map((role) => (
              <RoleTag key={role} role={role} />
            ))}
            <StatusTag status={user.status} />
            {user.mustSetPassword && (
              <Tag color="warning" className="!m-0">
                Chưa đặt mật khẩu
              </Tag>
            )}
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
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </Card>
  );
}

interface UserDetailViewProps {
  user: Account;
  belowProfile?: ReactNode;
  aside?: ReactNode;
  actions?: ReactNode;
  editor?: ReactNode;
}

export function UserDetailView({ user, belowProfile, aside, actions, editor }: UserDetailViewProps) {
  return (
    <div className="flex flex-col gap-4">
      <UserSummary user={user} actions={actions} />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={aside ? 16 : 24}>
          <div className="flex flex-col gap-4">
            {editor ? (
              <Card>{editor}</Card>
            ) : (
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
                <AccountRoleSection user={user} />
              </Card>
            )}
            {belowProfile}
          </div>
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
  belowProfile?: (user: Account) => ReactNode;
  aside?: (user: Account) => ReactNode;
  actions?: (user: Account) => ReactNode;
  editor?: (user: Account) => ReactNode;
}

export function UserDetailLoader({
  id,
  backLabel,
  onBack,
  belowProfile,
  aside,
  actions,
  editor,
}: UserDetailLoaderProps) {
  const { data: user, isPending, isError, error, notFound, refetch } = useUserDetail(id);

  const back = (
    <button
      type="button"
      onClick={onBack}
      className="mb-3 inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-[15px] font-semibold text-sc-muted hover:text-sc-ink"
    >
      <ChevronLeft size={18} />
      {backLabel}
    </button>
  );

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
  if (isPending) return <PageLoading />;
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
      <UserDetailView
        user={user}
        belowProfile={belowProfile?.(user)}
        aside={aside?.(user)}
        actions={actions?.(user)}
        editor={editor?.(user)}
      />
    </>
  );
}
