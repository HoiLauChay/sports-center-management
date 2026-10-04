import type { Account, Invoice, Paginated } from '@sports-center/shared';
import { walletService } from '~/features/wallet/services/wallet.service';
import { mockRequest } from '~/lib/mock/errors';
import {
  cancelCounterInvoice,
  checkoutOrder,
  getCounterInvoice,
  getOrder,
  listOrders,
  quoteOrder,
  startCounterTransfer,
} from '../mocks/checkout';
import { loadCatalog, type Actor } from '../mocks/pricing';
import type { CheckoutRequest, ListOrdersQuery, Order, Quote, QuoteRequest } from '../types';

export function actorOf(user: Pick<Account, 'id' | 'role' | 'fullName'>): Actor {
  return { id: user.id, role: user.role, fullName: user.fullName };
}

/** Wallet balance of the buyer as the wallet endpoints report it. */
function balanceReader(actor: Actor) {
  return (accountId: string) =>
    actor.role === 'MEMBER' && accountId === actor.id
      ? walletService.balanceOfMine()
      : walletService.balanceOfMember(accountId);
}

/**
 * Cart pricing, checkout and orders. These endpoints (`/checkout/quote`, `/checkout`, `/orders`, #90 #104 #112 #113
 * #114 #129 #138) are not live yet, so each call runs against the mock engine in `../mocks`, which follows
 * `api.design.md`. Replace a method's body with the matching `privateApi` call once its endpoint ships.
 */
export const checkoutService = {
  quote: (user: Account, request: QuoteRequest): Promise<Quote> => {
    const actor = actorOf(user);
    return mockRequest(() => quoteOrder(actor, request, balanceReader(actor)), 120);
  },

  checkout: (user: Account, request: CheckoutRequest): Promise<Order> => {
    const actor = actorOf(user);
    return mockRequest(() => checkoutOrder(actor, request, balanceReader(actor)), 450);
  },

  /** Counter order paid by transfer: returns the invoice holding the QR. */
  startCounterTransfer: (user: Account, request: CheckoutRequest): Promise<Invoice> => {
    const actor = actorOf(user);
    return mockRequest(async () => {
      const { settings } = await loadCatalog();
      return startCounterTransfer(actor, request, balanceReader(actor), settings.invoiceExpiryMinutes);
    }, 350);
  },

  getCounterInvoice: (user: Account, id: string): Promise<Invoice> => {
    const actor = actorOf(user);
    return mockRequest(() => getCounterInvoice(id, balanceReader(actor)), 80);
  },

  cancelCounterInvoice: (id: string): Promise<Invoice> => mockRequest(() => cancelCounterInvoice(id)),

  listOrders: (user: Account, query: ListOrdersQuery): Promise<Paginated<Order>> =>
    mockRequest(() => listOrders(actorOf(user), query)),

  getOrder: (user: Account, id: string): Promise<Order> => mockRequest(() => getOrder(actorOf(user), id), 120),
};
