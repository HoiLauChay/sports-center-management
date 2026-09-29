import type { AccountStatus } from '@sports-center/shared';

export const STATUS_ACTION: Record<AccountStatus, { label: string; title: string }> = {
  ACTIVE: {
    label: 'Kích hoạt lại',
    title: 'Kích hoạt lại tài khoản?',
  },
  INACTIVE: {
    label: 'Vô hiệu hóa',
    title: 'Vô hiệu hóa tài khoản?',
  },
  BANNED: {
    label: 'Khóa tài khoản',
    title: 'Khóa tài khoản?',
  },
};
