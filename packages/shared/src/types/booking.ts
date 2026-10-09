import type { BookingBenefit, BookingStatus, FacilityPackageStatus } from '../constants/enums';
import type { Ref } from './api';
import type { Person } from './audit';

export interface Booking {
  id: string;
  facility: Ref;
  date: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  unitPrice: number;
  benefit: BookingBenefit;
  paidAmount: number | null;
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
  status: FacilityPackageStatus;
  unitPrice: number;
  bookings: Booking[];
}
