import { z } from 'zod';

import { STAFF_ROLES } from '../constants/enums';
import { optionalText, phoneSchema } from './account';
import { emailSchema, fullNameSchema } from './auth';

export const createUserProfileSchema = z.object({
  bio: optionalText(2000, 'Giới thiệu'),
  experience: optionalText(2000, 'Kinh nghiệm'),
  certifications: optionalText(2000, 'Chứng chỉ'),
  staffNotes: optionalText(2000, 'Ghi chú nhân sự'),
});

export const createUserBodySchema = z.object({
  email: emailSchema,
  fullName: fullNameSchema,
  role: z.enum(STAFF_ROLES, 'Vui lòng chọn vai trò'),
  phone: phoneSchema.nullable().optional(),
  profile: createUserProfileSchema.optional(),
});

export type CreateUserBody = z.infer<typeof createUserBodySchema>;
export type CreateUserInput = z.input<typeof createUserBodySchema>;
