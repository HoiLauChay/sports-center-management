import type { CommerceState, MockOrder } from '~/lib/mock/commerce';

export type BalanceOf = (accountId: string) => Promise<number>;

function recomputeStatus(order: MockOrder) {
  order.refundedAmount = order.items.reduce((sum, item) => sum + item.refundedAmount, 0);
  order.status =
    order.refundedAmount <= 0 ? 'PAID' : order.refundedAmount >= order.totalAmount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
}

/** Adds a refund to one order line of a mock order and rolls it up to the order (BR_3.7, BR_3.13). */
export function addRefundToItem(state: CommerceState, orderItemId: string, amount: number) {
  for (const order of state.orders) {
    const item = order.items.find((entry) => entry.id === orderItemId);
    if (!item) continue;
    item.refundedAmount += amount;
    recomputeStatus(order);
    return order;
  }
  return undefined;
}
