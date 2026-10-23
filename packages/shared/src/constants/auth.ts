export const GOOGLE_LOGIN_ERROR = {
  CANCELLED: 'Bạn đã huỷ đăng nhập bằng Google.',
  NOT_CONFIGURED: 'Đăng nhập bằng Google đang tạm thời không khả dụng.',
  STATE_MISMATCH: 'Phiên đăng nhập Google đã hết hạn, vui lòng thử lại.',
  EMAIL_UNVERIFIED: 'Email Google của bạn chưa được xác minh.',
  ACCOUNT_INACTIVE: 'Tài khoản đã bị vô hiệu hóa.',
  FAILED: 'Không đăng nhập được bằng Google, vui lòng thử lại.',
} as const;

export type GoogleLoginErrorCode = keyof typeof GOOGLE_LOGIN_ERROR;

export const AUTH_RULES = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 72,
  OTP_LENGTH: 6,
  OTP_RESEND_COOLDOWN: 60,
} as const;
