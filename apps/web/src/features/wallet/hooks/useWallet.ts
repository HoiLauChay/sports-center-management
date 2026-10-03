import type { Invoice, WalletQuery } from '@sports-center/shared';
import { keepPreviousData, queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { sessionQueryOptions, useCurrentUser } from '~/features/auth';
import { walletService } from '../services/wallet.service';

export const INVOICE_POLL_MS = 3000;

export const walletQueryKey = (accountId: string) => ['wallet', accountId] as const;

export function useMyWallet(query: WalletQuery) {
  const { id } = useCurrentUser();
  return useQuery({
    queryKey: [...walletQueryKey(id), query],
    queryFn: () => walletService.getMine(id, query),
    placeholderData: keepPreviousData,
  });
}

/** Wallet of any member, for staff screens. */
export function useMemberWallet(memberId: string | undefined, query: WalletQuery) {
  return useQuery({
    queryKey: [...walletQueryKey(memberId ?? ''), query],
    queryFn: () => walletService.getForMember(memberId!, query),
    enabled: Boolean(memberId),
    placeholderData: keepPreviousData,
  });
}

export function invoiceQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['invoices', id],
    queryFn: () => walletService.getInvoice(id),
    retry: false,
    // Polls only while the invoice is waiting for money. React Query stops polling as soon as the
    // page that observes this query unmounts, so leaving the screen stops the checks.
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' ? INVOICE_POLL_MS : false),
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({ ...invoiceQueryOptions(id ?? ''), enabled: Boolean(id) });
}

/** Refreshes everything that shows a balance once an invoice has been paid. */
export function useRefreshAfterPaid(invoice: Invoice | undefined, onPaid?: (invoice: Invoice) => void) {
  const queryClient = useQueryClient();
  const previous = useRef<Invoice['status']>(undefined);
  const callback = useRef(onPaid);
  useEffect(() => {
    callback.current = onPaid;
  });

  useEffect(() => {
    if (!invoice) return;
    if (previous.current === 'PENDING' && invoice.status === 'PAID') {
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: sessionQueryOptions.queryKey });
      callback.current?.(invoice);
    }
    previous.current = invoice.status;
  }, [invoice, queryClient]);
}

/** Seconds left until `expiresAt`, ticking once a second; `null` when there is no deadline. */
export function useCountdown(expiresAt: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
}

export function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
