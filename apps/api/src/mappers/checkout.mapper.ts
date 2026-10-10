import type { Quote } from '@sports-center/shared';

import type { PreparedOrder } from '~/services/checkout/types';

export const toQuoteResponse = (prepared: PreparedOrder, walletBalance: number | null): Quote => {
  const codeOf = (couponId: string | null) => prepared.coupons.find(({ id }) => id === couponId)?.code ?? null;
  return {
    items: prepared.lines.map(({ lineNumber, input, result, couponDiscount, couponId }) => {
      const base = { lineNumber, type: input.type, selection: input, couponDiscount, couponCode: codeOf(couponId) };
      if (!result.ok) {
        return {
          ...base,
          valid: false,
          error: result.error,
          snapshot: null,
          subtotal: 0,
          membershipDiscount: 0,
          total: 0,
        };
      }
      return {
        ...base,
        valid: true,
        snapshot: result.snapshot,
        subtotal: result.subtotal,
        membershipDiscount: result.membershipDiscount,
        total: result.subtotal - result.membershipDiscount - couponDiscount,
      };
    }),
    coupons: prepared.coupons.map(({ code, valid, applied, discount, lineNumbers, error }) => ({
      code,
      valid,
      applied,
      discount,
      lineNumbers,
      ...(error && { error }),
    })),
    subtotal: prepared.subtotal,
    membershipDiscount: prepared.membershipDiscount,
    couponDiscount: prepared.couponDiscount,
    total: prepared.total,
    walletBalance,
    canCheckout: prepared.valid,
  };
};
