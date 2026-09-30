export interface SpecializationResponse {
  id: string;
  coach: { id: string; fullName: string };
  sport: { id: string; name: string };
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}
