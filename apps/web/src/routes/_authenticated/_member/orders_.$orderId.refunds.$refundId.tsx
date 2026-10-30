import { createFileRoute } from '@tanstack/react-router';
import { MemberRefundDetailPage } from '~/features/orders';

export const Route = createFileRoute('/_authenticated/_member/orders_/$orderId/refunds/$refundId')({
  component: MemberRefundDetailPage,
});
