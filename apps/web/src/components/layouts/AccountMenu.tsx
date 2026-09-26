import type { Account } from '@sports-center/shared';
import { useNavigate } from '@tanstack/react-router';
import { Avatar, Dropdown, type MenuProps } from 'antd';
import { LogOut, UserRound } from 'lucide-react';
import { PATHS } from '~/constants/paths';
import { ROLE_LABEL } from '~/constants/roles';
import { useLogout } from '~/features/auth';
import { initialsOf } from '~/lib/format';
import { ROLE_COLOR } from '~/styles/antd-theme';

export function AccountMenu({ user, compact = false }: { user: Account; compact?: boolean }) {
  const navigate = useNavigate();
  const logout = useLogout();
  const roleColor = ROLE_COLOR[user.role];

  const items: MenuProps['items'] = [
    { key: 'profile', icon: <UserRound size={16} />, label: 'Hồ sơ cá nhân' },
    { type: 'divider' },
    { key: 'logout', icon: <LogOut size={16} />, label: 'Đăng xuất', danger: true },
  ];

  const onClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'profile') void navigate({ to: PATHS.profile });
    if (key === 'logout') void logout();
  };

  return (
    <Dropdown menu={{ items, onClick }} trigger={['click']} placement="bottomRight">
      <button type="button" aria-label="Menu tài khoản" className={`sc-user-pill${compact ? ' compact' : ''}`}>
        <Avatar
          src={user.avatarUrl ?? undefined}
          size={30}
          className="shrink-0 !text-xs !font-bold"
          style={{ background: `${roleColor}22`, color: roleColor }}
        >
          {initialsOf(user.fullName)}
        </Avatar>
        {!compact && (
          <span className="flex flex-col items-start leading-[1.15]">
            <span className="max-w-[180px] truncate text-[13px] font-semibold">{user.fullName}</span>
            <span className="text-[11px] font-semibold" style={{ color: roleColor }}>
              {ROLE_LABEL[user.role]}
            </span>
          </span>
        )}
      </button>
    </Dropdown>
  );
}
