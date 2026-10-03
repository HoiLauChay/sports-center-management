import { createFileRoute } from '@tanstack/react-router';
import { TopUpPage } from '~/features/wallet';

export const Route = createFileRoute('/_authenticated/_member/wallet/top-up')({
  component: TopUpPage,
});
