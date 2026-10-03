export const ROLES = ['MANAGER', 'COACH', 'MEMBER', 'RECEPTIONIST'] as const;
export type Role = (typeof ROLES)[number];

export const ACCOUNT_STATUSES = ['ACTIVE', 'INACTIVE', 'BANNED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;
export type Gender = (typeof GENDERS)[number];

export const OTP_PURPOSES = ['REGISTER', 'PASSWORD_RESET'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export const UPLOAD_PURPOSES = [
  'AVATAR',
  'COVER_IMAGE',
  'SESSION_ATTACHMENT',
  'COURSE_THUMBNAIL',
  'SPORT_ICON',
] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];
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
  'INVOICE',
] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export const CREATABLE_ROLES = ['COACH', 'RECEPTIONIST'] as const;
export type CreatableRole = (typeof CREATABLE_ROLES)[number];

export const SPECIALIZATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type SpecializationStatus = (typeof SPECIALIZATION_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  'PAYMENT',
  'MEMBERSHIP',
  'BOOKING',
  'CLASS',
  'TRAINING',
  'SUPPORT',
  'SYSTEM',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const FACILITY_TYPES = ['GYM', 'COURT', 'ROOM', 'FIELD'] as const;
export type FacilityType = (typeof FACILITY_TYPES)[number];

export const PAYMENT_METHODS = ['WALLET', 'CASH', 'CARD', 'TRANSFER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const WALLET_TRANSACTION_TYPES = ['TOP_UP', 'PAYMENT', 'REFUND'] as const;
export type WalletTransactionType = (typeof WALLET_TRANSACTION_TYPES)[number];

export const INVOICE_PURPOSES = ['WALLET_TOP_UP', 'COUNTER_ORDER'] as const;
export type InvoicePurpose = (typeof INVOICE_PURPOSES)[number];

export const INVOICE_STATUSES = ['PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'FAILED'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const ORDER_ITEM_TYPES = ['MEMBERSHIP', 'FACILITY_BOOKING', 'FACILITY_PACKAGE', 'COURSE_ENROLLMENT'] as const;
export type OrderItemType = (typeof ORDER_ITEM_TYPES)[number];

export const ORDER_STATUSES = ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const BANK_TRANSACTION_STATUSES = ['MATCHED', 'UNMATCHED', 'RESOLVED', 'IGNORED'] as const;
export type BankTransactionStatus = (typeof BANK_TRANSACTION_STATUSES)[number];

export const SCHEDULE_CLASH_REASONS = [
  'CLOSED',
  'PAST',
  'OFF_GRID',
  'MAINTENANCE',
  'CLASS_SESSION',
  'BOOKED',
  'FULL',
  'COACH_BUSY',
  'MEMBER_BUSY',
] as const;
export type ScheduleClashReason = (typeof SCHEDULE_CLASH_REASONS)[number];

export const FACILITY_SLOT_STATUSES = ['AVAILABLE', 'FULL', 'CLASS', 'MAINTENANCE', 'CLOSED'] as const;
export type FacilitySlotStatus = (typeof FACILITY_SLOT_STATUSES)[number];
