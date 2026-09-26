import { z } from 'zod';

import { GENDERS } from '../constants/enums';
import { fullNameSchema } from './auth';

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} tối đa ${max} ký tự`)
    .transform((value) => value || null)
    .nullable()
    .optional();

const optionalUrl = (label: string) =>
  z
    .string()
    .trim()
    .max(2048, `${label} tối đa 2048 ký tự`)
    .transform((value) => value || null)
    .pipe(z.url({ protocol: /^https$/, error: `${label} phải là URL https hợp lệ` }).nullable())
    .nullable()
    .optional();

export const normalizePhone = (value: string) => {
  const digits = value.replace(/[\s.\-()]/g, '');
  if (digits.startsWith('+84')) return `0${digits.slice(3)}`;
  if (digits.startsWith('84') && digits.length === 11) return `0${digits.slice(2)}`;
  return digits;
};

export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => (value ? normalizePhone(value) : null))
  .pipe(
    z
      .string()
      .regex(/^0\d{9,10}$/, 'Số điện thoại không hợp lệ')
      .nullable(),
  );

export const dateOfBirthSchema = z.iso
  .date('Ngày sinh không hợp lệ')
  .refine((value) => value >= '1900-01-01', 'Ngày sinh không hợp lệ')
  .refine((value) => new Date(value) <= new Date(), 'Ngày sinh không được ở tương lai');

export const MEMBER_PROFILE_FIELDS = ['emergencyContact', 'fitnessGoals', 'healthNotes'] as const;
export const COACH_PROFILE_FIELDS = ['bio', 'experience', 'certifications', 'coverImageUrl'] as const;

export const updateProfileFieldsSchema = z.object({
  emergencyContact: optionalText(255, 'Liên hệ khẩn cấp'),
  fitnessGoals: optionalText(2000, 'Mục tiêu tập luyện'),
  healthNotes: optionalText(2000, 'Ghi chú sức khỏe'),
  bio: optionalText(2000, 'Giới thiệu'),
  experience: optionalText(2000, 'Kinh nghiệm'),
  certifications: optionalText(2000, 'Chứng chỉ'),
  coverImageUrl: optionalUrl('Ảnh bìa'),
});

export const updateMeBodySchema = z.object({
  fullName: fullNameSchema.optional(),
  phone: phoneSchema.nullable().optional(),
  dateOfBirth: dateOfBirthSchema.nullable().optional(),
  gender: z.enum(GENDERS, 'Giới tính không hợp lệ').nullable().optional(),
  address: optionalText(500, 'Địa chỉ'),
  avatarUrl: optionalUrl('Ảnh đại diện'),
  profile: updateProfileFieldsSchema.optional(),
});

export type UpdateMeBody = z.infer<typeof updateMeBodySchema>;
