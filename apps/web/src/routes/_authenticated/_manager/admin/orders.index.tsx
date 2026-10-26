import { createFileRoute } from '@tanstack/react-router';
import { AdminOrdersPage, parseStaffOrdersSearch } from '~/features/orders';

export const Route = createFileRoute('/_authenticated/_manager/admin/orders/')({
  validateSearch: parseStaffOrdersSearch,
  component: AdminOrdersPage,
});
