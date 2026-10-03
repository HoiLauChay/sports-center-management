import { createFileRoute } from '@tanstack/react-router';
import { BankTransactionsPage } from '~/features/bank-transactions';

export const Route = createFileRoute('/_authenticated/_manager/admin/bank-transactions')({
  component: BankTransactionsPage,
});
