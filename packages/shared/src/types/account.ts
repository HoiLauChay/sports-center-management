import type { AccountStatus, Gender, LoginNextStep, Role } from '../constants/enums';

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
  roles: Role[];
  status: AccountStatus;
  emailVerifiedAt: string | null;
  mustSetPassword: boolean;
  createdAt: string;
  profile: MemberProfile | CoachProfile | StaffProfile;
}

export type AccountSummary = Pick<
  Account,
  'id' | 'email' | 'fullName' | 'phone' | 'avatarUrl' | 'role' | 'roles' | 'status' | 'createdAt'
>;

export type StudentAccount = Pick<
  Account,
  'id' | 'email' | 'fullName' | 'phone' | 'dateOfBirth' | 'gender' | 'avatarUrl' | 'role'
> & {
  profile: Omit<MemberProfile, 'walletBalance'>;
};

export interface LoginStartResult {
  next: LoginNextStep;
  retryAfter?: number;
}

export interface ActivationInfo {
  email: string;
  fullName: string;
}
