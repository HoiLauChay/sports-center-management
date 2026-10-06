import { z } from 'zod';

import { CLASS_DERIVED_STATUSES, CLASS_STATUSES } from '../constants/enums';
import { pageQuerySchema } from './pagination';
import { timeOfDaySchema } from './time';

const weeklySlotSchema = z
  .object({
    dayOfWeek: z.int('Thứ không hợp lệ').min(0, 'Thứ không hợp lệ').max(6, 'Thứ không hợp lệ'),
    startTime: timeOfDaySchema,
    endTime: timeOfDaySchema,
  })
  .refine(({ startTime, endTime }) => startTime < endTime, {
    path: ['endTime'],
    message: 'Giờ kết thúc phải sau giờ bắt đầu',
  });

const studentsSchema = z.int('Sĩ số phải là số nguyên').min(1, 'Sĩ số tối thiểu là 1').max(1000, 'Sĩ số quá lớn');

export const createClassBodySchema = z
  .object({
    courseId: z.uuid('Mã khóa học không hợp lệ'),
    name: z
      .string('Tên lớp không được để trống')
      .trim()
      .min(1, 'Tên lớp không được để trống')
      .max(100, 'Tên lớp tối đa 100 ký tự'),
    facilityId: z.uuid('Mã cơ sở không hợp lệ'),
    startDate: z.iso.date('Ngày bắt đầu không hợp lệ'),
    weeklySchedule: z
      .array(weeklySlotSchema, 'Lịch tuần không hợp lệ')
      .min(1, 'Chọn ít nhất một buổi trong tuần')
      .max(14, 'Lịch tuần tối đa 14 buổi')
      .refine(
        (slots) =>
          slots.every((slot, index) =>
            slots.every(
              (other, j) =>
                j <= index ||
                other.dayOfWeek !== slot.dayOfWeek ||
                other.endTime <= slot.startTime ||
                slot.endTime <= other.startTime,
            ),
          ),
        'Các buổi trong cùng một ngày bị chồng giờ',
      ),
    minStudents: studentsSchema.default(1),
    maxStudents: studentsSchema,
  })
  .refine(({ minStudents, maxStudents }) => minStudents <= maxStudents, {
    path: ['maxStudents'],
    message: 'Sĩ số tối đa phải không nhỏ hơn sĩ số tối thiểu',
  });

export type CreateClassBody = z.infer<typeof createClassBodySchema>;

export const classIdParamsSchema = z.object({ id: z.uuid('Mã lớp không hợp lệ') });

export const enrollmentIdParamsSchema = z.object({ id: z.uuid('Mã đăng ký không hợp lệ') });

export const listClassesQuerySchema = pageQuerySchema.extend({
  q: z.string().trim().min(1).max(100, 'Từ khóa tối đa 100 ký tự').optional(),
  status: z.enum(CLASS_STATUSES, 'Trạng thái không hợp lệ').optional(),
  derivedStatus: z.enum(CLASS_DERIVED_STATUSES, 'Trạng thái không hợp lệ').optional(),
  sportId: z.uuid('Mã bộ môn không hợp lệ').optional(),
  courseId: z.uuid('Mã khóa học không hợp lệ').optional(),
  coachId: z.uuid('Mã huấn luyện viên không hợp lệ').optional(),
  facilityId: z.uuid('Mã cơ sở không hợp lệ').optional(),
  openForEnrollment: z.stringbool('Bộ lọc nhận đăng ký không hợp lệ').optional(),
});

export const updateClassBodySchema = z
  .strictObject({
    name: createClassBodySchema.shape.name.optional(),
    minStudents: studentsSchema.optional(),
    maxStudents: studentsSchema.optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), 'Cần ít nhất một trường để cập nhật')
  .refine(
    ({ minStudents, maxStudents }) =>
      minStudents === undefined || maxStudents === undefined || minStudents <= maxStudents,
    { path: ['maxStudents'], message: 'Sĩ số tối đa phải không nhỏ hơn sĩ số tối thiểu' },
  );

export const reviewClassBodySchema = z.object({
  note: z.string().trim().min(1).max(500, 'Ghi chú tối đa 500 ký tự').optional(),
});

export type ListClassesQuery = z.infer<typeof listClassesQuerySchema>;
export type UpdateClassBody = z.infer<typeof updateClassBodySchema>;
export type ReviewClassBody = z.infer<typeof reviewClassBodySchema>;
