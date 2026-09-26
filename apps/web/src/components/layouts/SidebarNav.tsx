import type { Account } from '@sports-center/shared';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { Avatar, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { LogOut, X } from 'lucide-react';
import { Fragment, useMemo } from 'react';
import logoMark from '~/assets/brand/logo-mark.svg';
import { navGroupsFor } from '~/config/navigation';
import { PATHS } from '~/constants/paths';
import { ROLE_COLOR_ON_DARK, ROLE_LABEL } from '~/constants/roles';
import { useLogout } from '~/features/auth';
import { initialsOf } from '~/lib/format';

function isActive(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

interface SidebarNavProps {
  user: Account;
  collapsed?: boolean;
  mobile?: boolean;
  onClose?: () => void;
  onNavigate?: () => void;
}

export function SidebarNav({ user, collapsed = false, mobile = false, onClose, onNavigate }: SidebarNavProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const logout = useLogout();
  const groups = useMemo(() => navGroupsFor(user.role), [user.role]);
  const roleColor = ROLE_COLOR_ON_DARK[user.role];

  const activePath = useMemo(
    () =>
      groups
        .flatMap((g) => g.items.map((i) => i.path))
        .filter((p) => isActive(pathname, p))
        .sort((a, b) => b.length - a.length)[0],
    [groups, pathname],
  );

  const openProfile = () => {
    onNavigate?.();
    void navigate({ to: PATHS.profile });
  };

  return (
    <div className={`sc-nav${collapsed ? ' collapsed' : ''}${mobile ? ' mobile' : ''}`}>
      <Link to={PATHS.dashboard} onClick={onNavigate} className="sc-nav-brand">
        <img src={logoMark} width={34} height={34} alt="Sports Center" className="block shrink-0" />
        {!collapsed && (
          <div className="sc-nav-brand-text">
            <div className="t">Sports Center</div>
            <div className="s">Management System</div>
          </div>
        )}
      </Link>
      {mobile && (
        <button type="button" aria-label="Đóng menu" className="sc-nav-close" onClick={onClose}>
          <X size={16} />
        </button>
      )}

      {!collapsed && (
        <div className="sc-nav-role">
          <span className="dot" style={{ background: roleColor, boxShadow: `0 0 0 3px ${roleColor}33` }} />
          {ROLE_LABEL[user.role]}
          <span className="date">{dayjs().format('ddd, DD/MM')}</span>
        </div>
      )}

      <nav aria-label="Menu chính" className="sc-nav-scroll">
        {groups.map((group, index) => (
          <div key={group.title ?? index} className="sc-nav-section">
            {group.title && !collapsed && <div className="sc-nav-section-title">{group.title}</div>}
            {group.title && collapsed && <div className="sc-nav-section-line" />}
            {group.items.map(({ path, label, icon: Icon }) => {
              const link = (
                <Link
                  to={path}
                  onClick={onNavigate}
                  className={`sc-nav-item${path === activePath ? ' active' : ''}`}
                  aria-current={path === activePath ? 'page' : undefined}
                >
                  <span className="ico">
                    <Icon size={16} strokeWidth={2} />
                  </span>
                  {!collapsed && <span className="lbl">{label}</span>}
                </Link>
              );
              return collapsed ? (
                <Tooltip key={path} title={label} placement="right">
                  {link}
                </Tooltip>
              ) : (
                <Fragment key={path}>{link}</Fragment>
              );
            })}
          </div>
        ))}
      </nav>

      <div
        className="sc-nav-user"
        role="button"
        tabIndex={0}
        aria-label="Mở hồ sơ"
        onClick={openProfile}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openProfile();
          }
        }}
      >
        <Avatar
          src={user.avatarUrl ?? undefined}
          size={collapsed ? 34 : 38}
          className="shrink-0 !text-[13px] !font-bold"
          style={{ background: `${roleColor}26`, color: roleColor, border: `1px solid ${roleColor}55` }}
        >
          {initialsOf(user.fullName)}
        </Avatar>
        {!collapsed && (
          <>
            <div className="meta">
              <div className="n">{user.fullName}</div>
              <div className="e">{user.email}</div>
            </div>
            <Tooltip title="Đăng xuất">
              <button
                type="button"
                aria-label="Đăng xuất"
                className="sc-nav-logout"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate?.();
                  void logout();
                }}
              >
                <LogOut size={16} />
              </button>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}
