import { createFileRoute } from '@tanstack/react-router';
import { ReceptionOrderDetailPage } from '~/features/orders';

export const Route = createFileRoute('/_authenticated/_receptionist/reception/orders/$orderId')({
  component: ReceptionOrderDetailPage,
});
