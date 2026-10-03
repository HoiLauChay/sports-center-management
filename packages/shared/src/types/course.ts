import type { Ref } from './api';

export interface Course {
  id: string;
  name: string;
  description: string | null;
  sport: Ref;
  totalSessions: number;
  price: number;
  thumbnailUrl: string | null;
}
