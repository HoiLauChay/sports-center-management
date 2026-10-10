import type { BookingBenefit, OrderItemType, OrderStatus, PaymentMethod } from '../constants/enums';
import type { CheckoutItemInput } from '../schemas/checkout';
import type { Person } from './audit';
import type { MembershipBenefits } from './membership';

export type ItemSnapshotBase = {
  title: string;
  startAt: string | null;
  endAt: string | null;
  discountPct: number;
};

export type FacilityBookingSnapshot = ItemSnapshotBase & {
  facilityName: string;
  sportNames: string[];
  date: string;
  startTime: string;
  endTime: string;
  slots: number;
  pricePerSlot: number;
  benefit: BookingBenefit;
};

export type CourseEnrollmentSnapshot = ItemSnapshotBase & {
  className: string;
  courseName: string;
  sportName: string;
  coachName: string;
  facilityName: string;
  sessions: number;
  startDate: string;
  endDate: string;
};

export type FacilityPackageSnapshot = ItemSnapshotBase & {
  facilityName: string;
  sportNames: string[];
  startDate: string;
  endDate: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  weeks: number;
  sessions: number;
  slotsPerSession: number;
  pricePerSlot: number;
  freeSessions: number;
};

export type MembershipSnapshot = ItemSnapshotBase & {
  packageName: string;
  price: number;
  durationDays: number;
  renewal: boolean;
  benefits: MembershipBenefits;
};

export type ItemSnapshot =
  FacilityBookingSnapshot | FacilityPackageSnapshot | CourseEnrollmentSnapshot | MembershipSnapshot;

export interface FacilityPackagePreview {
  bookings: {
    date: string;
    startTime: string;
    endTime: string;
    available: boolean;
    conflict?: 'BOOKED' | 'CLASS' | 'MAINTENANCE' | 'CLOSED';
  }[];
  isValid: boolean;
  unitPrice: number;
  basePrice: number;
}

export interface QuoteLine {
  lineNumber: number;
  type: OrderItemType;
  selection: CheckoutItemInput;
  valid: boolean;
  error?: { code: string; message: string };
  snapshot: Record<string, unknown> | null;
  subtotal: number;
  membershipDiscount: number;
  couponDiscount: number;
  couponCode: string | null;
  total: number;
}

export interface QuoteCoupon {
  code: string;
  valid: boolean;
  applied: boolean;
  discount: number;
  lineNumbers: number[];
  error?: string;
}

export interface Quote {
  items: QuoteLine[];
  coupons: QuoteCoupon[];
  subtotal: number;
  membershipDiscount: number;
  couponDiscount: number;
  total: number;
  walletBalance: number | null;
  canCheckout: boolean;
}

export interface OrderItem {
  id: string;
  lineNumber: number;
  type: OrderItemType;
  snapshot: Record<string, unknown>;
  subtotal: number;
  membershipDiscount: number;
  couponDiscount: number;
  couponCode: string | null;
  totalAmount: number;
  refundedAt: string | null;
  refId: string | null;
}

export interface OrderRefund {
  id: string;
  transactionCode: string;
  orderItemId: string | null;
  amount: number;
  reason: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  account: Person | null;
  guestName: string | null;
  guestPhone: string | null;
  createdBy: Person | null;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  coupons: { code: string; discount: number }[];
  subtotal: number;
  membershipDiscount: number;
  couponDiscount: number;
  totalAmount: number;
  items: OrderItem[];
  refunds: OrderRefund[];
  paidAt: string;
}
