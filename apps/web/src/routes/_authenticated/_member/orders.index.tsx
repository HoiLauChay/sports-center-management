import { createFileRoute } from '@tanstack/react-router';
import { MyOrdersPage } from '~/features/orders';

export const Route = createFileRoute('/_authenticated/_member/orders/')({
  component: MyOrdersPage,
});
