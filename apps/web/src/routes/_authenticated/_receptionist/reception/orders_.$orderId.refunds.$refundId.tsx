import { createFileRoute } from '@tanstack/react-router';
import { ReceptionRefundDetailPage } from '~/features/orders';

export const Route = createFileRoute('/_authenticated/_receptionist/reception/orders_/$orderId/refunds/$refundId')({
  component: ReceptionRefundDetailPage,
});
