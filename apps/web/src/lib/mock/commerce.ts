import type { PaymentMethod, Person } from '@sports-center/shared';
import type { Booking, FacilityPackage } from '~/features/bookings/types';
import type { OrderItemType, OrderStatus } from '~/features/checkout/types';
import type { Enrollment } from '~/features/classes/types';
import { createMockStore } from './store';

/** A facility package as stored: its bookings are kept by reference and expanded when read. */
export type StoredFacilityPackage = Omit<FacilityPackage, 'bookings'> & {
  bookingIds: string[];
  accountId: string;
  orderItemId: string;
};

export interface MockOrderItem {
  id: string;
  lineNumber: number;
  type: OrderItemType;
  snapshot: Record<string, unknown>;
  subtotal: number;
  membershipDiscount: number;
  couponDiscount: number;
  totalAmount: number;
  refundedAmount: number;
  refId: string;
}

/** An order made by the old mock checkout, kept so the mock-only pages (#167) still read this browser's data. */
export interface MockOrder {
  id: string;
  orderNumber: string;
  account: Person | null;
  guestName: string | null;
  guestPhone: string | null;
  createdBy: Person | null;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  coupon: { code: string; discount: number } | null;
  subtotal: number;
  membershipDiscount: number;
  couponDiscount: number;
  totalAmount: number;
  refundedAmount: number;
  items: MockOrderItem[];
  paidAt: string;
}

export interface CommerceState {
  orders: MockOrder[];
  bookings: Booking[];
  packages: StoredFacilityPackage[];
  enrollments: Enrollment[];
}

/**
 * Orders, bookings, packages and enrollments the old mock checkout created in this browser. Checkout now goes
 * through the API; the pages that still read this store are replaced by server data once #167 ships.
 */
export const commerceStore = createMockStore<CommerceState>('sc_mock_commerce_v1', () => ({
  orders: [],
  bookings: [],
  packages: [],
  enrollments: [],
}));
