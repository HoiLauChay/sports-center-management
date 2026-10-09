import type { ClassStatus } from '../constants/enums';

export interface Sport {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  isActive: boolean;
}

export interface SportDeletionImpact {
  affectedClasses: { id: string; name: string; status: ClassStatus; startDate: string | null; students: number }[];
  refundTotal: number;
}
