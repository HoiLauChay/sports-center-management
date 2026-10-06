import type { Person, Ref } from '@sports-center/shared';

export type BookingStatus = 'CONFIRMED' | 'CANCELLED';
export type BookingBenefit = 'NONE' | 'DISCOUNT' | 'GYM_ACCESS' | 'FREE_SLOT';

export interface Booking {
  id: string;
  facility: Ref;
  date: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  unitPrice: number;
  benefit: BookingBenefit;
  paidAmount: number;
  refundedAmount: number;
  packageId: string | null;
  orderItemId: string;
  account: Person | null;
  guestName: string | null;
  guestPhone: string | null;
  createdAt: string;
}

export interface FacilityPackage {
  id: string;
  facility: Ref;
  startDate: string;
  endDate: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  status: 'ACTIVE' | 'CANCELLED';
  unitPrice: number;
  bookings: Booking[];
}

export type PackageConflict = 'BOOKED' | 'CLASS' | 'MAINTENANCE' | 'CLOSED';

export interface PackagePreviewRequest {
  facilityId: string;
  startDate: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  weeks: number;
}

export interface PackagePreviewBooking {
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
  conflict?: PackageConflict;
}

export interface PackagePreview {
  bookings: PackagePreviewBooking[];
  isValid: boolean;
  unitPrice: number;
  basePrice: number;
}

/** A range of consecutive slots picked on the grid. */
export interface SlotSelection {
  facilityId: string;
  startIndex: number;
  count: number;
}
