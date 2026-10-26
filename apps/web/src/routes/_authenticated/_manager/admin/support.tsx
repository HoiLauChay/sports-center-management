import { createFileRoute } from '@tanstack/react-router';
import { StaffSupportPage } from '~/features/support';

export const Route = createFileRoute('/_authenticated/_manager/admin/support')({
  component: StaffSupportPage,
});
