import { createFileRoute } from '@tanstack/react-router';
import { StaffSupportPage } from '~/features/support';

export const Route = createFileRoute('/_authenticated/_receptionist/reception/support')({
  component: StaffSupportPage,
});
