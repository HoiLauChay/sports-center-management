import { Outlet, useRouterState } from '@tanstack/react-router';
import { Button, Drawer, Layout } from 'antd';
import { Menu as MenuIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ForbiddenPage } from '~/components/feedback/RouteStatus';
import { PageLoading } from '~/components/feedback/States';
import { Logo } from '~/components/ui/Logo';
import { useAuthContext } from '~/features/auth';
import { canAccess } from '~/lib/access';
import { BRAND } from '~/styles/antd-theme';
import { AccountMenu } from './AccountMenu';
import { SidebarNav } from './SidebarNav';

const SIDER_WIDTH = 248;

export function MainLayout({ children }: { children?: ReactNode }) {
  const { user, isAuthReady } = useAuthContext();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!isAuthReady || !user) return <PageLoading fullScreen />;

  // The route guard only re-runs after auth resolves, so check here too to avoid mounting a forbidden page for one render.
  const content = children ?? (canAccess(user.role, pathname) ? <Outlet /> : <ForbiddenPage />);

  return (
    <Layout className="min-h-screen">
      <Layout.Sider width={SIDER_WIDTH} className="!sticky top-0 !hidden h-screen lg:!block">
        <SidebarNav role={user.role} />
      </Layout.Sider>

      <Drawer
        placement="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        closable={false}
        size={SIDER_WIDTH + 16}
        styles={{ body: { padding: 0, background: BRAND.ink } }}
        className="lg:hidden"
      >
        <SidebarNav role={user.role} onNavigate={() => setDrawerOpen(false)} />
      </Drawer>

      <Layout>
        <Layout.Header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-sc-border !px-4 md:!px-6">
          <div className="flex items-center gap-2 lg:invisible">
            <Button
              type="text"
              aria-label="Mở menu"
              icon={<MenuIcon size={20} />}
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden"
            />
            <Logo size={28} className="lg:hidden" />
          </div>
          <AccountMenu user={user} />
        </Layout.Header>

        <Layout.Content className="p-4 md:p-6">
          <div className="mx-auto w-full max-w-[1280px]">{content}</div>
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
