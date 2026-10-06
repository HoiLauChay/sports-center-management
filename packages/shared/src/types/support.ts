import type { SupportCategory, SupportStatus } from '../constants/enums';
import type { Person } from './audit';

export interface SupportRequest {
  id: string;
  account: Person;
  category: SupportCategory;
  subject: string;
  description: string;
  status: SupportStatus;
  resolutionNote: string | null;
  handledBy: Person | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
