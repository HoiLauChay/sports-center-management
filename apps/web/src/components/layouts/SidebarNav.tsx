import type { Role } from '@sports-center/shared';
import { Link, useRouter, useRouterState, type LinkProps } from '@tanstack/react-router';
import { Menu, type MenuProps } from 'antd';
import { useMemo } from 'react';
import { Logo } from '~/components/ui/Logo';
import { navGroupsFor } from '~/config/navigation';
import { PATHS } from '~/constants/paths';

type MenuItem = Required<MenuProps>['items'][number];

function isActive(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function SidebarNav({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const groups = useMemo(() => navGroupsFor(role, (path) => path in router.routesByPath), [role, router]);

  const items = useMemo<MenuItem[]>(
    () =>
      groups.flatMap((group, index): MenuItem[] => {
        const children: MenuItem[] = group.items.map(({ path, label, icon: Icon }) => ({
          key: path,
          icon: <Icon size={17} strokeWidth={2} />,
          // Items are filtered to registered routes, so the path is a valid `to`.
          label: <Link to={path as LinkProps['to']}>{label}</Link>,
        }));
        if (group.title) return [{ type: 'group', key: `group-${index}`, label: group.title, children }];
        return index === 0 ? children : [{ type: 'divider', key: `divider-${index}` }, ...children];
      }),
    [groups],
  );

  const selectedKey = useMemo(() => {
    const paths = groups.flatMap((g) => g.items.map((i) => i.path)).filter((p) => isActive(pathname, p));
    return paths.sort((a, b) => b.length - a.length)[0];
  }, [groups, pathname]);

  return (
    <nav aria-label="Menu chính" className="flex h-full flex-col">
      <Link
        to={PATHS.dashboard}
        onClick={onNavigate}
        className="flex h-16 shrink-0 items-center px-5 !text-sc-paper no-underline"
      >
        <Logo size={34} withText />
      </Link>
      <Menu
        theme="dark"
        mode="inline"
        items={items}
        selectedKeys={selectedKey ? [selectedKey] : []}
        onClick={onNavigate}
        className="flex-1 overflow-y-auto !border-e-0 px-3 pb-6"
      />
    </nav>
  );
}
