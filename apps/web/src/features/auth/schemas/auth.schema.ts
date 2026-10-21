import { changePasswordBodySchema, registerBaseSchema, withPasswordConfirmation } from '@sports-center/shared';
import { z } from 'zod';

export const registerSchema = withPasswordConfirmation(
  registerBaseSchema.extend({
    agree: z.boolean().refine((v) => v, 'Bạn cần đồng ý điều khoản để tiếp tục'),
  }),
);

export const changePasswordSchema = changePasswordBodySchema;

export type RegisterFormValues = z.infer<typeof registerSchema>;
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
