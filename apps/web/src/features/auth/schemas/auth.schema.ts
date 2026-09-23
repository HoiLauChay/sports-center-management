import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;
export const OTP_LENGTH = 6;

export const emailSchema = z.string().trim().min(1, 'Email không được để trống').email('Email không hợp lệ');

const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`)
  .max(72, 'Mật khẩu tối đa 72 ký tự')
  .regex(/[A-Za-z]/, 'Mật khẩu phải chứa ít nhất một chữ cái')
  .regex(/\d/, 'Mật khẩu phải chứa ít nhất một chữ số');

const otp = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `Mã xác nhận gồm ${OTP_LENGTH} chữ số`);

const confirmPassword = z.string().min(1, 'Vui lòng nhập lại mật khẩu');

const matchPassword = { message: 'Mật khẩu xác nhận không khớp', path: ['confirmPassword'] };

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mật khẩu không được để trống'),
});

export const registerSchema = z
  .object({
    email: emailSchema,
    otp,
    password,
    confirmPassword,
    agree: z.boolean().refine((v) => v, 'Bạn cần đồng ý điều khoản để tiếp tục'),
  })
  .refine((d) => d.password === d.confirmPassword, matchPassword);

export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    otp,
    password,
    confirmPassword,
  })
  .refine((d) => d.password === d.confirmPassword, matchPassword);

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
