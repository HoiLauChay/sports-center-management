import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '~/features/auth';
import { checkoutService } from '~/features/checkout/services/checkout.service';
import type { ListOrdersQuery } from '~/features/checkout/types';

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
    queryFn: () => checkoutService.getOrder(user, id),
    retry: false,
  });
}
