import { createFileRoute } from '@tanstack/react-router';
import { ReceptionOrdersPage } from '~/features/orders';

export const Route = createFileRoute('/_authenticated/_receptionist/reception/orders/')({
  component: ReceptionOrdersPage,
});
