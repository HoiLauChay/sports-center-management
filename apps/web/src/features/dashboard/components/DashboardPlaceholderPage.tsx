import { ThunderboltFilled } from '@ant-design/icons';
import { Link } from '@tanstack/react-router';
import { Button, Tag } from 'antd';
import { PATHS } from '~/constants/paths';
import { useAuthContext, useLogout, type Role } from '~/features/auth';

const ROLE_LABEL: Record<Role, string> = {
  MANAGER: 'Quản lý trung tâm',
  COACH: 'Huấn luyện viên',
  RECEPTIONIST: 'Lễ tân',
  MEMBER: 'Thành viên',
};

export function DashboardPlaceholderPage() {
  const { user } = useAuthContext();
  const logout = useLogout();

  if (!user) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-sc-paper px-4 font-body text-sc-ink">
      <div className="w-full max-w-md rounded-xl border border-sc-border bg-white p-8 shadow-[0_6px_24px_rgba(20,19,15,.06)]">
        <Link
          to={PATHS.home}
          className="mb-6 inline-flex items-center gap-2.5 font-display text-[20px] font-extrabold tracking-[.02em] text-sc-ink uppercase no-underline"
        >
          <i className="inline-flex h-7 w-7 items-center justify-center rounded-[3px] bg-sc-lime text-sm not-italic text-sc-ink">
            <ThunderboltFilled />
          </i>
          Sports Center
        </Link>

        <h1 className="m-0 font-display text-[32px] leading-none font-extrabold uppercase">Xin chào</h1>
        <p className="mt-2 mb-6 text-sc-muted">Bạn đã đăng nhập. Dashboard theo vai trò sẽ xuất hiện ở đây.</p>

        <dl className="m-0 mb-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-sc-muted">Email</dt>
          <dd className="m-0 font-medium">{user.email}</dd>
          <dt className="text-sc-muted">Vai trò</dt>
          <dd className="m-0">
            <Tag color="green">{ROLE_LABEL[user.role]}</Tag>
          </dd>
        </dl>

        <Button block onClick={() => void logout()}>
          Đăng xuất
        </Button>
      </div>
    </div>
  );
}
