import type { Account } from '@sports-center/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { useCurrentUser } from '~/features/auth';
import { checkoutService } from '../services/checkout.service';
import { counterDraftStore, memberCartStore, type CartState, type CartStore } from '../store/cartStore';
import type { CheckoutBuyer, CheckoutItemInput, Quote } from '../types';

export function useCartState(store: CartStore): CartState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

/** The signed-in member's cart (browser `localStorage`, one per account). */
export function useMemberCart() {
  const { id } = useCurrentUser();
  const store = memberCartStore(id);
  const cart = useCartState(store);
  return { store, cart, count: cart.lines.length };
}

/** The receptionist's counter draft (browser `sessionStorage`, private to this tab). */
export function useCounterDraft() {
  const { id } = useCurrentUser();
  const store = counterDraftStore(id);
  const cart = useCartState(store);
  return { store, cart };
}

interface UseQuoteParams {
  user: Account;
  buyer?: CheckoutBuyer;
  items: CheckoutItemInput[];
  couponCode?: string;
  enabled?: boolean;
}

export const quoteQueryKey = (
  userId: string,
  buyer: CheckoutBuyer | undefined,
  items: CheckoutItemInput[],
  couponCode?: string,
) => ['quote', userId, buyer ?? null, items, couponCode || null] as const;

/** Prices the draft on the server every time its lines, buyer or coupon change (UC_3.18). */
export function useQuote({ user, buyer, items, couponCode, enabled = true }: UseQuoteParams) {
  return useQuery<Quote>({
    queryKey: quoteQueryKey(user.id, buyer, items, couponCode),
    queryFn: () => checkoutService.quote({ buyer, items, couponCode: couponCode || undefined }),
    enabled: enabled && items.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 0,
    gcTime: 60_000,
    retry: false,
  });
}
