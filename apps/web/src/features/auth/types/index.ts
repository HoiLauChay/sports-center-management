export type Role = 'MANAGER' | 'COACH' | 'RECEPTIONIST' | 'MEMBER';
export type UserStatus = 'ACTIVE' | 'INACTIVE';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type OtpPurpose = 'REGISTER' | 'PASSWORD_RESET';

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

export interface SendOtpPayload {
  email: string;
  purpose: OtpPurpose;
  captchaToken: string;
}

export interface RegisterPayload {
  email: string;
  otp: string;
  password: string;
  confirmPassword: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ResetPasswordPayload {
  email: string;
  otp: string;
  password: string;
  confirmPassword: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  password: string;
  confirmPassword: string;
}
