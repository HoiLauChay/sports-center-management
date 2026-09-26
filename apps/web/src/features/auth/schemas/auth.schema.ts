import {
  changePasswordBodySchema,
  loginBodySchema,
  registerBaseSchema,
  resetPasswordBodySchema,
  withPasswordConfirmation,
} from '@sports-center/shared';
import { z } from 'zod';

export const loginSchema = loginBodySchema;

export const registerSchema = withPasswordConfirmation(
  registerBaseSchema.extend({
    agree: z.boolean().refine((v) => v, 'Bạn cần đồng ý điều khoản để tiếp tục'),
  }),
);

export const resetPasswordSchema = resetPasswordBodySchema;

export const changePasswordSchema = changePasswordBodySchema;

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
