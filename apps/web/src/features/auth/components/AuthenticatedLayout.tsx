import { Outlet } from '@tanstack/react-router';
import { Spin } from 'antd';
import { useAuthContext } from '../context/AuthContext';

export function AuthenticatedLayout() {
  const { isAuthReady } = useAuthContext();

  if (!isAuthReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return <Outlet />;
}
