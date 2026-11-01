import { createFileRoute } from '@tanstack/react-router';
import { AdminRefundDetailPage } from '~/features/orders';

export const Route = createFileRoute('/_authenticated/_manager/admin/orders_/$orderId/refunds/$refundId')({
  component: AdminRefundDetailPage,
});
