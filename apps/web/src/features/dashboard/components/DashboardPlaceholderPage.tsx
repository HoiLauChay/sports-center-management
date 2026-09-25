import { Card } from 'antd';
import { PageHeader } from '~/components/ui/PageHeader';
import { RoleTag } from '~/components/ui/RoleTag';
import { useAuthContext } from '~/features/auth';

export function DashboardPlaceholderPage() {
  const { user } = useAuthContext();
  if (!user) return null;

  return (
    <>
      <PageHeader title={`Xin chào, ${user.fullName}`} description="Tổng quan theo vai trò sẽ hiển thị ở đây." />
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sc-muted">Bạn đang đăng nhập với vai trò</span>
          <RoleTag role={user.role} />
        </div>
      </Card>
    </>
  );
}
