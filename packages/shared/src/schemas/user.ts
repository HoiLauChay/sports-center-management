import { z } from 'zod';

import { ACCOUNT_STATUSES, CREATABLE_ROLES, ROLES } from '../constants/enums';
import { optionalText, phoneSchema, updateMeBodySchema, updateProfileFieldsSchema } from './account';
import { emailSchema, fullNameSchema } from './auth';
import { pageQuerySchema } from './pagination';

export const listUsersQuerySchema = pageQuerySchema.extend({
  q: z.string().trim().max(255, 'Từ khóa tối đa 255 ký tự').optional(),
  role: z.enum(ROLES, 'Vai trò không hợp lệ').optional(),
  status: z.enum(ACCOUNT_STATUSES, 'Trạng thái không hợp lệ').optional(),
});

export const userIdParamsSchema = z.object({ id: z.uuid('Mã người dùng không hợp lệ') });

export const createUserProfileSchema = z.object({
  bio: optionalText(2000, 'Giới thiệu'),
  experience: optionalText(2000, 'Kinh nghiệm'),
  certifications: optionalText(2000, 'Chứng chỉ'),
  staffNotes: optionalText(2000, 'Ghi chú nhân sự'),
});

export const createUserBodySchema = z.object({
  email: emailSchema,
  fullName: fullNameSchema,
  role: z.enum(CREATABLE_ROLES, 'Vui lòng chọn vai trò'),
  phone: phoneSchema.nullable().optional(),
  profile: createUserProfileSchema.optional(),
});

export const updateUserBodySchema = updateMeBodySchema.omit({ avatarUrl: true }).extend({
  profile: updateProfileFieldsSchema
    .omit({ coverImageUrl: true })
    .extend({ staffNotes: optionalText(2000, 'Ghi chú nhân sự') })
    .optional(),
});

export const updateUserStatusBodySchema = z.object({
  status: z.enum(ACCOUNT_STATUSES, 'Trạng thái không hợp lệ'),
  reason: optionalText(500, 'Lý do'),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type CreateUserBody = z.infer<typeof createUserBodySchema>;
export type CreateUserInput = z.input<typeof createUserBodySchema>;
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
export type UpdateUserInput = z.input<typeof updateUserBodySchema>;
export type UpdateUserStatusBody = z.infer<typeof updateUserStatusBodySchema>;
