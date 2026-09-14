import { z } from 'zod';

import { AUTH } from '~/constants/auth';

const email = z.email('Email không hợp lệ!').trim().toLowerCase();

const password = z
  .string()
  .min(AUTH.PASSWORD_MIN_LENGTH, `Mật khẩu phải có ít nhất ${AUTH.PASSWORD_MIN_LENGTH} ký tự!`)
  .max(72, 'Mật khẩu tối đa 72 ký tự!')
  .regex(/[A-Za-z]/, 'Mật khẩu phải chứa ít nhất một chữ cái!')
  .regex(/\d/, 'Mật khẩu phải chứa ít nhất một chữ số!');

const otp = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${AUTH.OTP_LENGTH}}$`), 'Mã xác nhận không hợp lệ!');

const withConfirm = <T extends { password: string; confirmPassword: string }>(schema: z.ZodType<T>) =>
  schema.refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp!',
    path: ['confirmPassword'],
  });

export const sendOtpSchema = z.object({
  body: z.object({
    email,
    purpose: z.enum(['REGISTER', 'PASSWORD_RESET']),
    captchaToken: z.string().min(1, 'Vui lòng xác thực captcha!'),
  }),
});

export const registerSchema = z.object({
  body: withConfirm(
    z.object({
      email,
      otp,
      password,
      confirmPassword: z.string().min(1, 'Mật khẩu xác nhận không được để trống!'),
    }),
  ),
});

export const loginSchema = z.object({
  body: z.object({
    email,
    password: z.string().min(1, 'Mật khẩu không được để trống!'),
  }),
});

export const changePasswordSchema = z.object({
  body: withConfirm(
    z.object({
      currentPassword: z.string().min(1, 'Mật khẩu hiện tại không được để trống!'),
      password,
      confirmPassword: z.string().min(1, 'Mật khẩu xác nhận không được để trống!'),
    }),
  ).refine((data) => data.currentPassword !== data.password, {
    message: 'Mật khẩu mới phải khác mật khẩu hiện tại!',
    path: ['password'],
  }),
});

export const resetPasswordSchema = z.object({
  body: withConfirm(
    z.object({
      email,
      otp,
      password,
      confirmPassword: z.string().min(1, 'Mật khẩu xác nhận không được để trống!'),
    }),
  ),
});

export type SendOtpBody = z.infer<typeof sendOtpSchema>['body'];
export type RegisterBody = z.infer<typeof registerSchema>['body'];
export type LoginBody = z.infer<typeof loginSchema>['body'];
export type ChangePasswordBody = z.infer<typeof changePasswordSchema>['body'];
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>['body'];
