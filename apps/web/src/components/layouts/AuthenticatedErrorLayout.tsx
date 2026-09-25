import { useQueryClient } from '@tanstack/react-query';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { RouteErrorPage } from '~/components/feedback/RouteStatus';
import { sessionQueryOptions } from '~/features/auth';
import { MainLayout } from './MainLayout';

export function AuthenticatedErrorLayout(props: ErrorComponentProps) {
  const user = useQueryClient().getQueryData(sessionQueryOptions.queryKey);
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <RouteErrorPage {...props} />
      </div>
    );
  }
  return (
    <MainLayout>
      <RouteErrorPage {...props} />
    </MainLayout>
  );
}
