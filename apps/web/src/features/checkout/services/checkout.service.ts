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
    const { page, limit, from, to } = query;
    const { data } =
      user.role === 'MEMBER'
        ? await privateApi.get<ApiResponse<Paginated<Order>>>('/me/orders', { params: { page, limit, from, to } })
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

  /** Saves the PDF receipt the server renders for the order. */
  downloadReceipt: async (orderId: string, orderNumber: string) => {
    const { data } = await privateApi.get<Blob>(`${orderPath(orderId)}/receipt`, { responseType: 'blob' });
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt-${orderNumber}.pdf`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  /** Prints the exact server-rendered PDF receipt. */
  printReceipt: async (orderId: string) => {
    const { data } = await privateApi.get<Blob>(`${orderPath(orderId)}/receipt`, { responseType: 'blob' });
    const url = URL.createObjectURL(data);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = url;
    document.body.appendChild(iframe);

    return new Promise<void>((resolve, reject) => {
      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            resolve();
          } catch {
            const w = window.open(url, '_blank');
            if (w) {
              w.focus();
              w.onload = () => w.print();
              resolve();
            } else {
              reject(new Error('Trình duyệt đã chặn cửa sổ in ấn'));
            }
          }
          setTimeout(() => {
            iframe.remove();
            URL.revokeObjectURL(url);
          }, 60_000);
        }, 500);
      };
      iframe.onerror = (e) => {
        iframe.remove();
        URL.revokeObjectURL(url);
        reject(e);
      };
    });
  },
};
