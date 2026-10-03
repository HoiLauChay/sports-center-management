import { z } from 'zod';

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
