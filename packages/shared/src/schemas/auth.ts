import { z } from 'zod';

import { AUTH_RULES } from '../constants/auth';
import { OTP_PURPOSES } from '../constants/enums';

const { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, OTP_LENGTH } = AUTH_RULES;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Email không được để trống')
  .pipe(z.email('Email không hợp lệ'));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`)
  .max(PASSWORD_MAX_LENGTH, `Mật khẩu tối đa ${PASSWORD_MAX_LENGTH} ký tự`)
  .regex(/[A-Za-z]/, 'Mật khẩu phải chứa ít nhất một chữ cái')
  .regex(/\d/, 'Mật khẩu phải chứa ít nhất một chữ số');

export const otpSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `Mã xác nhận gồm ${OTP_LENGTH} chữ số`);

const confirmPasswordSchema = z.string().min(1, 'Vui lòng nhập lại mật khẩu');

export const fullNameSchema = z
  .string()
  .trim()
  .min(1, 'Họ tên không được để trống')
  .max(255, 'Họ tên tối đa 255 ký tự');

export const withPasswordConfirmation = <T extends z.ZodType<{ password: string; confirmPassword: string }>>(
  schema: T,
) =>
  schema.refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

export const sendOtpBodySchema = z.object({
  email: emailSchema,
  purpose: z.enum(OTP_PURPOSES),
  captchaToken: z.string().min(1, 'Vui lòng xác thực captcha'),
});

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mật khẩu không được để trống'),
});

export const registerBaseSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
  fullName: fullNameSchema,
  password: passwordSchema,
  confirmPassword: confirmPasswordSchema,
});

export const registerBodySchema = withPasswordConfirmation(registerBaseSchema);

export const resetPasswordBodySchema = withPasswordConfirmation(
  z.object({
    email: emailSchema,
    otp: otpSchema,
    password: passwordSchema,
    confirmPassword: confirmPasswordSchema,
  }),
);

export const changePasswordBodySchema = withPasswordConfirmation(
  z.object({
    currentPassword: z.string().min(1, 'Mật khẩu hiện tại không được để trống'),
    password: passwordSchema,
    confirmPassword: confirmPasswordSchema,
  }),
).refine((data) => data.currentPassword !== data.password, {
  message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
  path: ['password'],
});

export type SendOtpBody = z.infer<typeof sendOtpBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type RegisterBody = z.infer<typeof registerBodySchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
