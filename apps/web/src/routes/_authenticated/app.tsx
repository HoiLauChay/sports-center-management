import { createFileRoute } from '@tanstack/react-router';
import { DashboardPlaceholderPage } from '~/features/dashboard';

export const Route = createFileRoute('/_authenticated/app')({
  component: DashboardPlaceholderPage,
});
