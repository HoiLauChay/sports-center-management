import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '~/features/auth';
import { checkoutService } from '~/features/checkout/services/checkout.service';
import type { ListOrdersQuery } from '~/features/checkout/types';
import { walletService } from '~/features/wallet';

export function useOrders(query: ListOrdersQuery) {
  const user = useCurrentUser();
  return useQuery({
    queryKey: ['orders', 'list', user.id, query],
    queryFn: () => checkoutService.listOrders(user, query),
    placeholderData: keepPreviousData,
  });
}

export function useOrder(id: string) {
  const user = useCurrentUser();
  return useQuery({
    queryKey: ['orders', 'detail', user.id, id],
    queryFn: () => checkoutService.getOrder(id),
    retry: false,
  });
}

/** Pending counter QR order-payment invoices created for the current member (`GET /me/invoices?purpose=COUNTER_ORDER&status=PENDING`). */
export function usePendingOrderInvoices() {
  const user = useCurrentUser();
  return useQuery({
    queryKey: ['invoices', 'counter-order', user.id],
    queryFn: () => walletService.listInvoices({ page: 1, limit: 10, purpose: 'COUNTER_ORDER', status: 'PENDING' }),
    enabled: user.role === 'MEMBER',
    refetchInterval: 30_000,
  });
}
