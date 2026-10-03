import { createFileRoute } from '@tanstack/react-router';
import { MemberOrderDetailPage } from '~/features/orders';

export const Route = createFileRoute('/_authenticated/_member/orders/$orderId')({
  component: MemberOrderDetailPage,
});
