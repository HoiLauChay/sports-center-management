import { createFileRoute } from '@tanstack/react-router';
import { CouponsPage } from '~/features/coupons';

export const Route = createFileRoute('/_authenticated/_manager/admin/coupons')({
  component: CouponsPage,
});
