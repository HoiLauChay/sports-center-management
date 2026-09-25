import { Avatar, Card, Descriptions } from 'antd';
import { PageHeader } from '~/components/ui/PageHeader';
import { RoleTag } from '~/components/ui/RoleTag';
import { useCurrentUser } from '~/features/auth';
import { formatDate } from '~/lib/format';

const GENDER_LABEL = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' } as const;

export function ProfilePage() {
  const user = useCurrentUser();

  return (
    <>
      <PageHeader title="Hồ sơ" description="Thông tin tài khoản của bạn." />
      <Card>
        <div className="mb-6 flex items-center gap-4">
          <Avatar src={user.avatarUrl ?? undefined} size={64} className="!bg-sc-primary !text-2xl">
            {user.fullName.charAt(0).toUpperCase()}
          </Avatar>
          <div className="flex flex-col items-start gap-1">
            <span className="text-lg font-semibold">{user.fullName}</span>
            <RoleTag role={user.role} />
          </div>
        </div>
        <Descriptions column={{ xs: 1, md: 2 }} bordered size="middle">
          <Descriptions.Item label="Email">{user.email}</Descriptions.Item>
          <Descriptions.Item label="Số điện thoại">{user.phone ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Ngày sinh">
            {user.dateOfBirth ? formatDate(user.dateOfBirth) : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Giới tính">{user.gender ? GENDER_LABEL[user.gender] : '—'}</Descriptions.Item>
          <Descriptions.Item label="Ngày tham gia">{formatDate(user.createdAt)}</Descriptions.Item>
          <Descriptions.Item label="Địa chỉ">{user.address ?? '—'}</Descriptions.Item>
        </Descriptions>
      </Card>
    </>
  );
}
