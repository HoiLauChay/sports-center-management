import type { FacilityPackagePreview, Person, Ref } from '@sports-center/shared';

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

export type {
  FacilityPackagePreview as PackagePreview,
  FacilityPackagePreviewBody as PackagePreviewRequest,
} from '@sports-center/shared';

export type PackagePreviewBooking = FacilityPackagePreview['bookings'][number];
export type PackageConflict = NonNullable<PackagePreviewBooking['conflict']>;

/** A range of consecutive slots picked on the grid. */
export interface SlotSelection {
  facilityId: string;
  startIndex: number;
  count: number;
}
