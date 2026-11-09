import { createFileRoute } from '@tanstack/react-router';
import { ShopAdminPage } from '~/features/shop';

export const Route = createFileRoute('/_authenticated/_manager/admin/shop')({
  component: ShopAdminPage,
});
