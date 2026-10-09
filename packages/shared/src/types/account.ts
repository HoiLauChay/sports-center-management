import type { AccountStatus, Gender, Role } from '../constants/enums';

export interface MemberProfile {
  emergencyContact: string | null;
  fitnessGoals: string | null;
  healthNotes: string | null;
  walletBalance: number;
}

export interface CoachProfile {
  bio: string | null;
  experience: string | null;
  certifications: string | null;
  coverImageUrl: string | null;
}

export interface StaffProfile {
  staffNotes: string | null;
}

export interface Account {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: Gender | null;
  address: string | null;
  avatarUrl: string | null;
  role: Role;
  status: AccountStatus;
  emailVerifiedAt: string | null;
  createdAt: string;
  profile: MemberProfile | CoachProfile | StaffProfile;
}

export type AccountSummary = Pick<
  Account,
  'id' | 'email' | 'fullName' | 'phone' | 'avatarUrl' | 'role' | 'status' | 'createdAt'
>;

/** A member as the coach of their class sees them (`GET /users/{id}` for COACH): no wallet, address or account state. */
export type StudentAccount = Pick<
  Account,
  'id' | 'email' | 'fullName' | 'phone' | 'dateOfBirth' | 'gender' | 'avatarUrl' | 'role'
> & {
  profile: Omit<MemberProfile, 'walletBalance'>;
};
