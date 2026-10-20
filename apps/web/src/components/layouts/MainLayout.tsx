import { Link, Outlet } from '@tanstack/react-router';
import { Drawer, Grid, Layout } from 'antd';
import { useState, type ReactNode } from 'react';
import logoMark from '~/assets/brand/logo-mark.svg';
import { PageLoading } from '~/components/feedback/States';
import { PATHS } from '~/constants/paths';
import { useSession } from '~/features/auth';
import { CartButton } from '~/features/checkout';
import { NotificationBell } from '~/features/notifications';
import { BottomNav } from './BottomNav';
import { SidebarNav } from './SidebarNav';

const COLLAPSED_KEY = 'sc_nav_collapsed';

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function saveCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    return;
  }
}

export function MainLayout({ children }: { children?: ReactNode }) {
  const user = useSession();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = Grid.useBreakpoint().md === false;

  if (!user) return <PageLoading fullScreen />;

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    saveCollapsed(next);
  };

  return (
    <Layout className="min-h-screen" hasSider={!isMobile}>
      {!isMobile && <SidebarNav user={user} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />}
      {isMobile && (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          closable={false}
          size={288}
          styles={{ body: { padding: 0, background: 'var(--sc-ink)' } }}
        >
          <SidebarNav user={user} mobile onClose={() => setDrawerOpen(false)} onNavigate={() => setDrawerOpen(false)} />
        </Drawer>
      )}

      <Layout className="min-w-0">
        {isMobile && (
          <Layout.Header
            className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-b-sc-border-soft !bg-[rgba(255,255,255,0.92)] [backdrop-filter:blur(8px)]"
            style={{ padding: '0 12px', height: 56, lineHeight: '56px' }}
          >
            <Link to={PATHS.dashboard} className="flex min-w-0 items-center gap-2 !text-sc-ink no-underline">
              <img src={logoMark} width={28} height={28} alt="" className="block shrink-0" />
              <span className="font-display text-[17px] font-extrabold whitespace-nowrap uppercase">Sports Center</span>
            </Link>
            <div className="flex items-center gap-2">
              {user.role === 'MEMBER' && <CartButton />}
              <NotificationBell />
            </div>
          </Layout.Header>
        )}

        <Layout.Content className={isMobile ? 'px-4 pt-4 pb-[calc(88px+env(safe-area-inset-bottom))]' : 'p-9'}>
          <div className="mx-auto w-full max-w-[1120px]">{children ?? <Outlet />}</div>
        </Layout.Content>
        {isMobile && <BottomNav user={user} onMore={() => setDrawerOpen(true)} />}
      </Layout>
    </Layout>
  );
}
