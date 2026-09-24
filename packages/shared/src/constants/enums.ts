export const ROLES = ['MANAGER', 'COACH', 'MEMBER', 'RECEPTIONIST'] as const;
export type Role = (typeof ROLES)[number];

export const ACCOUNT_STATUSES = ['ACTIVE', 'INACTIVE', 'BANNED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;
export type Gender = (typeof GENDERS)[number];

export const OTP_PURPOSES = ['REGISTER', 'PASSWORD_RESET'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];
