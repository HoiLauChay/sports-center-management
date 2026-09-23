import type { Gender, Role, UserStatus } from '../constants/enums';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  gender: Gender | null;
  avatarUrl: string | null;
  role: Role;
  status: UserStatus;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
