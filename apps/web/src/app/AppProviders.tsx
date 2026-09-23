import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { App as AntApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { useEffect } from 'react';
import { AuthProvider, useAuthContext } from '~/features/auth';
import { antdTheme } from '~/styles/antd-theme';
import { queryClient } from './queryClient';
import { router } from './router';

function RouterWithAuth() {
  const auth = useAuthContext();

  useEffect(() => {
    if (!auth.isAuthReady) return;
    void router.invalidate();
  }, [auth.user, auth.isAuthReady]);

  return <RouterProvider router={router} context={{ auth }} />;
}

export function AppProviders() {
  return (
    <ConfigProvider theme={antdTheme} locale={viVN}>
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RouterWithAuth />
          </AuthProvider>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}
