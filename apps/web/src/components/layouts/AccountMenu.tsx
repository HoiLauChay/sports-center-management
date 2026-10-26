import type { Account, Role } from '@sports-center/shared';
import { useNavigate } from '@tanstack/react-router';
import { Avatar, Dropdown, type MenuProps } from 'antd';
import { ArrowLeftRight, Ellipsis, LogOut, UserRound } from 'lucide-react';
import { PATHS } from '~/constants/paths';
import { ROLE_LABEL } from '~/constants/roles';
import { useLogout, useSwitchRole } from '~/features/auth';
import { initialsOf } from '~/lib/format';
import { ROLE_COLOR_ON_DARK } from '~/styles/antd-theme';

interface AccountMenuProps {
  user: Account;
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function AccountMenu({ user, collapsed = false, onNavigate }: AccountMenuProps) {
  const navigate = useNavigate();
  const logout = useLogout();
  const switchRole = useSwitchRole();
  const otherRoles = user.roles.filter((role) => role !== user.role);
  const roleColor = ROLE_COLOR_ON_DARK[user.role];

  const items: MenuProps['items'] = [
    { key: 'profile', icon: <UserRound size={16} />, label: 'Hồ sơ cá nhân' },
    ...otherRoles.map((role) => ({
      key: `role:${role}`,
      icon: <ArrowLeftRight size={16} />,
      label: `Chuyển sang ${ROLE_LABEL[role]}`,
      disabled: switchRole.isPending,
    })),
    { type: 'divider' },
    { key: 'logout', icon: <LogOut size={16} />, label: 'Đăng xuất', danger: true },
  ];

  const onClick: MenuProps['onClick'] = ({ key }) => {
    onNavigate?.();
    if (key === 'profile') void navigate({ to: PATHS.profile });
    if (key === 'logout') void logout();
    if (key.startsWith('role:')) switchRole.mutate(key.slice('role:'.length) as Role);
  };

  return (
    <Dropdown menu={{ items, onClick }} trigger={['click']} placement={collapsed ? 'topLeft' : 'top'}>
      <button
        type="button"
        aria-label="Menu tài khoản"
        className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl border-0 bg-transparent [font:inherit] text-white [transition:background_0.15s] hover:bg-[rgba(255,255,255,0.08)] ${collapsed ? 'justify-center p-1.5' : 'p-2'}`}
      >
        <Avatar
          src={user.avatarUrl ?? undefined}
          size={36}
          className="shrink-0 !text-[14.5px] !font-bold"
          style={{ background: `${roleColor}33`, color: roleColor }}
        >
          {initialsOf(user.fullName)}
        </Avatar>
        {!collapsed && (
          <>
            <span className="flex min-w-0 flex-1 flex-col items-start leading-[1.2]">
              <span className="max-w-full truncate text-[15px] font-semibold">{user.fullName}</span>
              <span className="text-[13.5px] font-semibold" style={{ color: roleColor }}>
                {ROLE_LABEL[user.role]}
              </span>
            </span>
            <Ellipsis size={18} className="shrink-0 text-[rgba(255,255,255,0.6)]" />
          </>
        )}
      </button>
    </Dropdown>
  );
}
