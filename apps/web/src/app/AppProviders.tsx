import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { App as AntApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { antdTheme } from '~/styles/antd-theme';
import { queryClient } from './queryClient';
import { router } from './router';

export function AppProviders() {
  return (
    <ConfigProvider theme={antdTheme} locale={viVN}>
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}
