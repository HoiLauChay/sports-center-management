export const ROLES = ['MANAGER', 'COACH', 'MEMBER', 'RECEPTIONIST'] as const;
export type Role = (typeof ROLES)[number];

export const ACCOUNT_STATUSES = ['ACTIVE', 'INACTIVE', 'BANNED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;
export type Gender = (typeof GENDERS)[number];

export const OTP_PURPOSES = ['REGISTER', 'PASSWORD_RESET'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'RESOLVE', 'IGNORE'] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ENTITY_TYPES = [
  'ACCOUNT',
  'MEMBER_PROFILE',
  'COACH_PROFILE',
  'RECEPTIONIST_PROFILE',
  'MANAGER_PROFILE',
  'SPORT',
  'FACILITY',
  'FACILITY_MAINTENANCE',
  'COURSE',
  'CLASS',
  'CLASS_SESSION',
  'CLASS_COACH_REGISTRATION',
  'COACH_SPECIALIZATION',
  'MEMBERSHIP',
  'MEMBER_MEMBERSHIP',
  'COUPON',
  'SYSTEM_SETTING',
  'BANK_TRANSACTION',
  'WALLET_TOP_UP',
] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];
