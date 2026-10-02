import { createFileRoute } from '@tanstack/react-router';
import { WalletPage } from '~/features/wallet';

export const Route = createFileRoute('/_authenticated/_member/wallet/')({
  component: WalletPage,
});
