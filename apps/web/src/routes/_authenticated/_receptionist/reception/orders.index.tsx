import { createFileRoute } from '@tanstack/react-router';
import { parseStaffOrdersSearch, ReceptionOrdersPage } from '~/features/orders';

export const Route = createFileRoute('/_authenticated/_receptionist/reception/orders/')({
  validateSearch: parseStaffOrdersSearch,
  component: ReceptionOrdersPage,
});
