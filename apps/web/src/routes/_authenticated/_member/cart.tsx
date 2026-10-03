import { createFileRoute } from '@tanstack/react-router';
import { CartPage } from '~/features/checkout';

export const Route = createFileRoute('/_authenticated/_member/cart')({
  component: CartPage,
});
