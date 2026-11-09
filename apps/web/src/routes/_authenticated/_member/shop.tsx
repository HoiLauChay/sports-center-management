import { createFileRoute } from '@tanstack/react-router';
import { ShopPage } from '~/features/shop';

export const Route = createFileRoute('/_authenticated/_member/shop')({
  component: ShopPage,
});
