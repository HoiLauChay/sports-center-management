import type { Quote } from '@sports-center/shared';

import type { PreparedOrder } from '~/services/checkout/types';

export const toQuoteResponse = (prepared: PreparedOrder, walletBalance: number | null): Quote => ({
  items: prepared.lines.map(({ lineNumber, input, result }) => {
    const base = { lineNumber, type: input.type, selection: input, couponDiscount: 0 };
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
      total: result.subtotal - result.membershipDiscount,
    };
  }),
  coupon: prepared.coupon,
  subtotal: prepared.subtotal,
  membershipDiscount: prepared.membershipDiscount,
  couponDiscount: prepared.couponDiscount,
  total: prepared.total,
  walletBalance,
  canCheckout: prepared.valid,
});
