import type { Account, ApiResponse, Invoice, Paginated } from '@sports-center/shared';
import { privateApi } from '~/lib/http';
import type { CheckoutBody, CheckoutQuoteBody, CounterInvoiceBody, ListOrdersQuery, Order, Quote } from '../types';

const invoicePath = (id: string) => `/invoices/${encodeURIComponent(id)}`;
const orderPath = (id: string) => `/orders/${encodeURIComponent(id)}`;

/** Cart pricing, checkout, counter transfer invoices and orders. */
export const checkoutService = {
  quote: async (body: CheckoutQuoteBody) => {
    const { data } = await privateApi.post<ApiResponse<Quote>>('/checkout/quote', body);
    return data.result;
  },

  /** The idempotency key keeps a retried request from creating a second order. */
  checkout: async (body: CheckoutBody) => {
    const { data } = await privateApi.post<ApiResponse<Order>>('/checkout', body);
    return data.result;
  },

  /** Counter order paid by bank transfer: the invoice holds the QR, the order is made when it is paid. */
  startCounterTransfer: async (body: CounterInvoiceBody) => {
    const { data } = await privateApi.post<ApiResponse<Invoice>>('/checkout/invoices', body);
    return data.result;
  },

  getCounterInvoice: async (id: string) => {
    const { data } = await privateApi.get<ApiResponse<Invoice>>(invoicePath(id));
    return data.result;
  },

  cancelCounterInvoice: async (id: string) => {
    const { data } = await privateApi.post<ApiResponse<Invoice>>(`${invoicePath(id)}/cancel`);
    return data.result;
  },

  /** A member reads their own orders (`/me/orders`, date range only); staff read every order. */
  listOrders: async (user: Account, query: ListOrdersQuery) => {
    const { page, limit, from, to, status, orderNumber } = query;
    const { data } =
      user.role === 'MEMBER'
        ? await privateApi.get<ApiResponse<Paginated<Order>>>('/me/orders', {
            params: { page, limit, from, to, status, orderNumber },
          })
        : await privateApi.get<ApiResponse<Paginated<Order>>>('/orders', { params: query });
    return data.result;
  },

  getOrder: async (id: string) => {
    const { data } = await privateApi.get<ApiResponse<Order>>(orderPath(id));
    return data.result;
  },

  /** Fetches the raw PDF receipt blob rendered by the server. */
  getReceiptBlob: async (orderId: string) => {
    const { data } = await privateApi.get<Blob>(`${orderPath(orderId)}/receipt`, { responseType: 'blob' });
    return data;
  },
};
