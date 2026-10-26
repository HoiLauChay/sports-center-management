import { createFileRoute } from '@tanstack/react-router';
import { AdminOrderDetailPage } from '~/features/orders';

export const Route = createFileRoute('/_authenticated/_manager/admin/orders/$orderId')({
  component: AdminOrderDetailPage,
});
