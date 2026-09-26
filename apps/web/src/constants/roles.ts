import type { AccountStatus, Role } from '@sports-center/shared';

export const ROLE_LABEL: Record<Role, string> = {
  MANAGER: 'Quản lý',
  COACH: 'Huấn luyện viên',
  RECEPTIONIST: 'Lễ tân',
  MEMBER: 'Thành viên',
};

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Vô hiệu hóa',
  BANNED: 'Bị khóa',
};

/** Lighter role accent that stays readable on the dark side nav. */
export const ROLE_COLOR_ON_DARK: Record<Role, string> = {
  MANAGER: '#e07a4f',
  COACH: '#5cbf8a',
  MEMBER: '#38bdf8',
  RECEPTIONIST: '#eab308',
};
