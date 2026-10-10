import type { Account } from '@sports-center/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useRef, useState } from 'react';
import { errorPayload, toApiError } from '~/lib/http-errors';
import { checkoutService } from '../services/checkout.service';
import type { CheckoutBody, CheckoutBuyer, CheckoutItemInput, Order, Quote } from '../types';

interface CheckoutParams {
  user: Account;
  buyer?: CheckoutBuyer;
  items: CheckoutItemInput[];
  couponCode?: string;
  paymentMethod: CheckoutBody['paymentMethod'];
  /** Quote total the person is looking at; the server refuses (PRICE_CHANGED) when it no longer matches. */
  expectedTotal: number;
}

export interface PriceChange {
  quote: Quote;
  previousTotal: number;
}

interface UseCheckoutOptions {
  onPaid: (order: Order) => void;
  /** Called when the server returns a fresh quote (price changed / a line became invalid). */
  onQuote?: (quote: Quote) => void;
}

/**
 * Pays a draft order. One `idempotencyKey` is kept per distinct request, so clicking "Thanh toán" twice (or a retry
 * after a timeout) can never create two orders; the key changes only when the request itself changes.
 */
export function useCheckout({ onPaid, onQuote }: UseCheckoutOptions) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const keyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  /** Set synchronously so a second click in the same tick is ignored before React re-renders. */
  const inFlight = useRef(false);
  const [priceChange, setPriceChange] = useState<PriceChange | null>(null);

  const keyFor = (params: CheckoutParams) => {
    const fingerprint = JSON.stringify([
      params.buyer ?? null,
      params.items,
      params.couponCode ?? null,
      params.paymentMethod,
      params.expectedTotal,
    ]);
    if (keyRef.current?.fingerprint !== fingerprint) keyRef.current = { fingerprint, key: crypto.randomUUID() };
    return keyRef.current.key;
  };

  const mutation = useMutation({
    mutationFn: (params: CheckoutParams) =>
      checkoutService.checkout({
        buyer: params.buyer,
        items: params.items,
        couponCode: params.couponCode || undefined,
        paymentMethod: params.paymentMethod,
        expectedTotal: params.expectedTotal,
        idempotencyKey: keyFor(params),
      }),
    onSuccess: (order) => {
      keyRef.current = null;
      setPriceChange(null);
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      void queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      void queryClient.invalidateQueries({ queryKey: ['facility-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      onPaid(order);
    },
    onSettled: () => {
      inFlight.current = false;
    },
    onError: (error, params) => {
      const apiError = toApiError(error);
      const quote = errorPayload<Quote>(error, 'quote');
      if (apiError.code === 'PRICE_CHANGED' && quote) {
        setPriceChange({ quote, previousTotal: params.expectedTotal });
        onQuote?.(quote);
        return;
      }
      if (quote) onQuote?.(quote);
      message.error(apiError.message);
    },
  });

  return {
    pay: (params: CheckoutParams) => {
      if (inFlight.current) return;
      inFlight.current = true;
      mutation.mutate(params);
    },
    isPaying: mutation.isPending,
    priceChange,
    dismissPriceChange: () => setPriceChange(null),
  };
}
