import { createFileRoute } from '@tanstack/react-router';
import { ReceptionSupportPage } from '~/features/support';

export const Route = createFileRoute('/_authenticated/_receptionist/reception/support')({
  component: ReceptionSupportPage,
});
