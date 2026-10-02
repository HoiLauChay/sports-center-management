import { createFileRoute } from '@tanstack/react-router';
import { InvoicePage } from '~/features/wallet';

export const Route = createFileRoute('/_authenticated/invoices/$invoiceId')({
  component: InvoicePage,
});
