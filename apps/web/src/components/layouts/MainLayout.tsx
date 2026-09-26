import { Link, Outlet } from '@tanstack/react-router';
import { Button, Drawer, Grid, Layout, Tooltip } from 'antd';
import { Menu as MenuIcon, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import logoMark from '~/assets/brand/logo-mark.svg';
import { PageLoading } from '~/components/feedback/States';
import { PATHS } from '~/constants/paths';
import { useSession } from '~/features/auth';
import { AccountMenu } from './AccountMenu';
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
      {!isMobile && <SidebarNav user={user} collapsed={collapsed} />}
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
        <Layout.Header
          className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-b-sc-border-soft !bg-[rgba(255,255,255,0.9)] [backdrop-filter:blur(8px)]"
          style={{ padding: isMobile ? '0 12px' : '0 24px' }}
        >
          {isMobile ? (
            <div className="flex min-w-0 items-center gap-1.5">
              <Button
                type="text"
                aria-label="Mở menu"
                icon={<MenuIcon size={20} />}
                onClick={() => setDrawerOpen(true)}
              />
              <Link to={PATHS.dashboard} className="flex min-w-0 items-center gap-2 !text-sc-ink no-underline">
                <img src={logoMark} width={28} height={28} alt="" className="block shrink-0" />
                <b className="text-sm whitespace-nowrap">Sports Center</b>
              </Link>
            </div>
          ) : (
            <Tooltip title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'} placement="bottom">
              <button
                type="button"
                aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
                aria-pressed={collapsed}
                className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-sc-border bg-white text-sc-ink-2 [transition:all_0.15s] hover:border-[#b9d3c5] hover:bg-sc-primary-soft hover:text-sc-primary"
                onClick={toggleCollapsed}
              >
                {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
              </button>
            </Tooltip>
          )}
          <AccountMenu user={user} compact={isMobile} />
        </Layout.Header>

        <Layout.Content className="p-4 md:p-6">
          <div className="mx-auto w-full max-w-[1280px]">{children ?? <Outlet />}</div>
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
