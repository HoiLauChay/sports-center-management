import type { BookingBenefit } from '../constants/enums';
import type { Ref } from './api';
import type { Person } from './audit';

export interface Booking {
  id: string;
  facility: Ref;
  date: string;
  startTime: string;
  endTime: string;
  status: 'CONFIRMED' | 'CANCELLED';
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
  status: 'ACTIVE' | 'CANCELLED';
  unitPrice: number;
  bookings: Booking[];
}
