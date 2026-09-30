export interface MembershipPackage {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationDays: number;
  gymAccess: boolean;
  bookingDiscountPct: number;
  classDiscountPct: number;
  freeBookingSlotsPerMonth: number;
  isActive: boolean;
}
