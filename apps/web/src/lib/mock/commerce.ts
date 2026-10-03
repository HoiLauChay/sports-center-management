import type { Invoice, Role } from '@sports-center/shared';
import type { Booking, FacilityPackage } from '~/features/bookings/types';
import type { CheckoutRequest, Order } from '~/features/checkout/types';
import type { Enrollment } from '~/features/classes/types';
import { createMockStore } from './store';

/** A facility package as stored: its bookings are kept by reference and expanded when read. */
export type StoredFacilityPackage = Omit<FacilityPackage, 'bookings'> & {
  bookingIds: string[];
  accountId: string;
  orderItemId: string;
};

export interface CommerceState {
  orders: Order[];
  orderSeq: number;
  bookings: Booking[];
  packages: StoredFacilityPackage[];
  enrollments: Enrollment[];
  /** idempotencyKey -> the order the first request created (and a hash of the request body). */
  checkouts: Record<string, { hash: string; orderId: string }>;
  /** Counter transfer invoices (`purpose = COUNTER_ORDER`) together with the order they will turn into when paid. */
  counterInvoices: StoredCounterInvoice[];
}

export interface StoredCounterInvoice {
  invoice: Invoice;
  request: CheckoutRequest;
  actor: { id: string; role: Role; fullName: string };
}

/**
 * Orders, bookings, packages, enrollments and counter invoices created through the mock checkout (#90, #104,
 * #112, #113, #129, #138). They are replaced by server data once those endpoints exist.
 */
export const commerceStore = createMockStore<CommerceState>('sc_mock_commerce_v1', () => ({
  orders: [],
  orderSeq: 0,
  bookings: [],
  packages: [],
  enrollments: [],
  checkouts: {},
  counterInvoices: [],
}));
