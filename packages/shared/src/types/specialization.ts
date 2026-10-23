import type { SpecializationStatus } from '../constants/enums';
import type { Ref } from './api';
import type { Person } from './audit';

export interface Specialization {
  id: string;
  coach: Person;
  sport: Ref;
  status: SpecializationStatus;
  experienceYears: number | null;
  experienceNote: string | null;
  certificates: string[];
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}
