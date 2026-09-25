import type { Account } from '@sports-center/shared';
import { useNavigate } from '@tanstack/react-router';
import { Avatar, Dropdown, type MenuProps } from 'antd';
import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import { RoleTag } from '~/components/ui/RoleTag';
import { PATHS } from '~/constants/paths';
import { useLogout } from '~/features/auth';

function initials(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return ((parts.at(-1)?.[0] ?? '') + (parts.length > 1 ? (parts[0]?.[0] ?? '') : '')).toUpperCase();
}

export function AccountMenu({ user }: { user: Account }) {
  const navigate = useNavigate();
  const logout = useLogout();

  const items: MenuProps['items'] = [
    {
      key: 'info',
      disabled: true,
      className: '!cursor-default',
      label: (
        <div className="flex max-w-[240px] flex-col py-1">
          <span className="truncate font-semibold text-sc-ink">{user.fullName}</span>
          <span className="truncate text-xs text-sc-muted">{user.email}</span>
        </div>
      ),
    },
    { type: 'divider' },
    { key: 'profile', icon: <UserRound size={16} />, label: 'Hồ sơ' },
    { key: 'logout', icon: <LogOut size={16} />, label: 'Đăng xuất', danger: true },
  ];

  const onClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'profile') void navigate({ to: PATHS.profile });
    if (key === 'logout') void logout();
  };

  return (
    <Dropdown menu={{ items, onClick }} trigger={['click']} placement="bottomRight">
      <button
        type="button"
        aria-label="Menu tài khoản"
        className="flex cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-2 py-1.5 text-sc-ink transition-colors hover:bg-sc-paper"
      >
        <Avatar src={user.avatarUrl ?? undefined} size={34} className="!bg-sc-primary !font-semibold">
          {initials(user.fullName)}
        </Avatar>
        <span className="hidden flex-col items-start leading-tight sm:flex">
          <span className="max-w-[180px] truncate text-sm font-semibold">{user.fullName}</span>
          <span className="mt-0.5">
            <RoleTag role={user.role} />
          </span>
        </span>
        <ChevronDown size={16} className="text-sc-muted" />
      </button>
    </Dropdown>
  );
}
