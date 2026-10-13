import type { Account } from '@sports-center/shared';
import { Link, useRouterState } from '@tanstack/react-router';
import { Tooltip } from 'antd';
import { X } from 'lucide-react';
import { Fragment, useMemo } from 'react';
import logoMark from '~/assets/brand/logo-mark.svg';
import { navGroupsFor } from '~/config/navigation';
import { PATHS } from '~/constants/paths';

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
  const groups = useMemo(() => navGroupsFor(user.role), [user.role]);

  const activePath = useMemo(
    () =>
      groups
        .flatMap((g) => g.items.map((i) => i.path))
        .filter((p) => isActive(pathname, p))
        .sort((a, b) => b.length - a.length)[0],
    [groups, pathname],
  );

  return (
    <div
      className={`z-20 flex shrink-0 flex-col border-r border-r-[rgba(255,255,255,0.07)] bg-sc-ink text-[#d6d2c8] [transition:width_0.2s_ease] ${mobile ? 'relative h-full w-full' : `sticky top-0 h-screen ${collapsed ? 'w-[76px]' : 'w-[252px]'}`}`}
    >
      <Link
        to={PATHS.dashboard}
        onClick={onNavigate}
        className={`relative flex h-16 items-center gap-3 border-b border-b-[rgba(255,255,255,0.06)] no-underline ${collapsed ? 'px-[21px]' : 'pr-4 pl-5'}`}
      >
        <img src={logoMark} width={34} height={34} alt="Sports Center" className="block shrink-0" />
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-display text-[19px] leading-none font-extrabold tracking-[0.02em] text-white uppercase">
              Sports Center
            </div>
            <div className="mt-[3px] text-[11px] text-[rgba(255,255,255,0.4)]">Management System</div>
          </div>
        )}
      </Link>
      {mobile && (
        <button
          type="button"
          aria-label="Đóng menu"
          className="absolute top-[17px] right-3 flex size-[30px] cursor-pointer items-center justify-center rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] text-[#cbd5e1]"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      )}

      <nav
        aria-label="Menu chính"
        className="flex-1 overflow-y-auto px-3 py-3 [scrollbar-color:transparent_transparent] [scrollbar-width:thin] hover:[scrollbar-color:rgba(255,255,255,0.15)_transparent]"
      >
        {groups.map((group, index) => (
          <div key={group.title ?? index} className="mt-[10px]">
            {group.title && !collapsed && (
              <div className="px-3 pt-2 pb-1.5 font-display text-[12px] font-bold tracking-[0.14em] text-[rgba(255,255,255,0.35)] uppercase">
                {group.title}
              </div>
            )}
            {group.title && collapsed && <div className="mx-[14px] mt-[10px] mb-2 h-px bg-[rgba(255,255,255,0.07)]" />}
            {group.items.map(({ path, label, icon: Icon }) => {
              const active = path === activePath;
              const link = (
                <Link
                  to={path}
                  onClick={onNavigate}
                  className={`group relative mb-0.5 flex h-[38px] items-center gap-2.5 rounded-lg text-[13.5px] font-medium no-underline ![transition:background_0.15s,color_0.15s] ${collapsed ? 'justify-center p-0' : 'px-2.5'} ${active ? `!bg-[rgba(255,255,255,0.08)] !text-white ${collapsed ? '' : "before:absolute before:top-[9px] before:bottom-[9px] before:-left-3 before:w-[3px] before:rounded-[0_3px_3px_0] before:bg-sc-lime before:content-['']"}` : '!text-[rgba(255,255,255,0.66)] hover:!bg-[rgba(255,255,255,0.06)] hover:!text-white'}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-lg [transition:all_0.15s] ${active ? 'bg-sc-lime text-sc-ink' : 'bg-[rgba(255,255,255,0.04)] text-[rgba(255,255,255,0.7)] group-hover:bg-[rgba(255,255,255,0.1)] group-hover:text-white'}`}
                  >
                    <Icon size={16} strokeWidth={2} />
                  </span>
                  {!collapsed && <span className="flex-1 truncate">{label}</span>}
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
    </div>
  );
}
