import type { Account } from '@sports-center/shared';
import { Link, useRouterState } from '@tanstack/react-router';
import { Menu } from 'lucide-react';
import { useMemo } from 'react';
import { bottomNavFor, navGroupsFor } from '~/config/navigation';

const isActive = (pathname: string, path: string) => pathname === path || pathname.startsWith(`${path}/`);

const itemClass = (active: boolean) =>
  `flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 border-0 bg-transparent px-1 pt-2 pb-1.5 [font:inherit] text-[11.5px] font-semibold no-underline ${active ? '!text-sc-primary' : '!text-sc-muted'}`;

export function BottomNav({ user, onMore }: { user: Account; onMore: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = useMemo(() => bottomNavFor(user.role), [user.role]);

  const activePath = useMemo(
    () =>
      navGroupsFor(user.role)
        .flatMap((group) => group.items.map((item) => item.path))
        .filter((path) => isActive(pathname, path))
        .sort((a, b) => b.length - a.length)[0],
    [user.role, pathname],
  );
  const moreActive = !items.some((item) => item.path === activePath);

  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-t-sc-border-soft bg-[rgba(255,255,255,0.96)] pb-[env(safe-area-inset-bottom)] [backdrop-filter:blur(8px)]"
    >
      {items.map(({ path, label, icon: Icon }) => {
        const active = path === activePath;
        return (
          <Link
            key={path}
            to={path}
            data-tour={path}
            className={itemClass(active)}
            aria-current={active ? 'page' : undefined}
          >
            <span
              className={`flex h-7 w-12 items-center justify-center rounded-full ${active ? 'bg-sc-primary-soft' : ''}`}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
            </span>
            <span className="max-w-full truncate">{label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        data-tour="more"
        className={itemClass(moreActive)}
        onClick={onMore}
        aria-label="Mở menu đầy đủ"
      >
        <span
          className={`flex h-7 w-12 items-center justify-center rounded-full ${moreActive ? 'bg-sc-primary-soft' : ''}`}
        >
          <Menu size={20} />
        </span>
        <span>Thêm</span>
      </button>
    </nav>
  );
}
