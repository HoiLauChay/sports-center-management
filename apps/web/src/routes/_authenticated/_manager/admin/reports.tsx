import { createFileRoute } from '@tanstack/react-router';
import { ReportsPage } from '~/features/reports';

export const Route = createFileRoute('/_authenticated/_manager/admin/reports')({
  component: ReportsPage,
});
