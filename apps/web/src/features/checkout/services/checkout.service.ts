import type { Account, ApiResponse, Invoice, Paginated } from '@sports-center/shared';
import { privateApi } from '~/lib/http';
import type { CheckoutBody, CheckoutQuoteBody, CounterInvoiceBody, ListOrdersQuery, Order, Quote } from '../types';

export function actorOf(user: Pick<Account, 'id' | 'role' | 'fullName'>) {
  return { id: user.id, role: user.role, fullName: user.fullName };
}

/**
 * Cart pricing, checkout, counter invoices and orders.
 * Connects directly to backend API endpoints:
 * - POST /checkout/quote (Issue #110)
 * - POST /checkout (Issue #110)
 * - GET /me/orders (Member) & GET /orders (Staff) (Issue #110)
 * - GET /orders/:id (Issue #110)
 * - GET /orders/:id/receipt (Issue #110)
 * - POST /checkout/invoices (Issue #134)
 * - GET /invoices/:id (Issue #134)
 * - POST /invoices/:id/cancel (Issue #134)
 */
export const checkoutService = {
  /**
   * Calculates prices, discounts (memberships & coupons) and checks validity of all items.
   * `POST /checkout/quote`
   */
  quote: async (request: CheckoutQuoteBody): Promise<Quote> => {
    const { data } = await privateApi.post<ApiResponse<Quote>>('/checkout/quote', {
      buyer: request.buyer,
      items: request.items,
      couponCode: request.couponCode || undefined,
    });
    return data.result;
  },

  /**
   * Finalizes checkout and creates an Order.
   * `POST /checkout` with idempotencyKey to prevent duplicate charges.
   */
  checkout: async (request: CheckoutBody): Promise<Order> => {
    const { data } = await privateApi.post<ApiResponse<Order>>('/checkout', {
      buyer: request.buyer,
      items: request.items,
      couponCode: request.couponCode || undefined,
      paymentMethod: request.paymentMethod,
      expectedTotal: request.expectedTotal,
      idempotencyKey: request.idempotencyKey,
    });
    return data.result;
  },

  /**
   * Counter order paid by transfer: creates invoice and returns QR (`POST /checkout/invoices`).
   */
  startCounterTransfer: async (request: CounterInvoiceBody): Promise<Invoice> => {
    const { data } = await privateApi.post<ApiResponse<Invoice>>('/checkout/invoices', {
      buyer: request.buyer,
      items: request.items,
      expectedTotal: request.expectedTotal,
      couponCode: request.couponCode || undefined,
    });
    return data.result;
  },

  /**
   * Retrieves counter transfer invoice (`GET /invoices/:id`).
   */
  getCounterInvoice: async (id: string): Promise<Invoice> => {
    const { data } = await privateApi.get<ApiResponse<Invoice>>(`/invoices/${encodeURIComponent(id)}`);
    return data.result;
  },

  /**
   * Cancels a pending counter invoice (`POST /invoices/:id/cancel`).
   */
  cancelCounterInvoice: async (id: string): Promise<Invoice> => {
    const { data } = await privateApi.post<ApiResponse<Invoice>>(`/invoices/${encodeURIComponent(id)}/cancel`);
    return data.result;
  },

  /**
   * Lists orders for current member (`GET /me/orders`) or center-wide for staff (`GET /orders`).
   */
  listOrders: async (user: Account, query: ListOrdersQuery): Promise<Paginated<Order>> => {
    if (user.role === 'MEMBER') {
      const { data } = await privateApi.get<ApiResponse<Paginated<Order>>>('/me/orders', {
        params: {
          page: query.page,
          limit: query.limit,
          from: query.from,
          to: query.to,
        },
      });
      return data.result;
    }
    const { data } = await privateApi.get<ApiResponse<Paginated<Order>>>('/orders', { params: query });
    return data.result;
  },

  /**
   * Retrieves single order by id (`GET /orders/:id`).
   */
  getOrder: async (id: string): Promise<Order> => {
    const { data } = await privateApi.get<ApiResponse<Order>>(`/orders/${encodeURIComponent(id)}`);
    return data.result;
  },

  /**
   * Downloads server-generated PDF receipt (`GET /orders/:id/receipt`).
   */
  downloadReceipt: async (orderId: string, orderNumber: string): Promise<void> => {
    const response = await privateApi.get(`/orders/${encodeURIComponent(orderId)}/receipt`, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt-${orderNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Some browsers start the download after `click()` returns, so the URL is released a moment later.
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  },
};
