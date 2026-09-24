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
