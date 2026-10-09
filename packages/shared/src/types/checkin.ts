import type { Person } from './audit';

export interface CheckIn {
  id: string;
  account: Person;
  checkedBy: Person;
  checkedInAt: string;
}
