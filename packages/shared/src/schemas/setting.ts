import { z } from 'zod';

import { MAX_MONEY } from '../constants/money';

const timeSchema = (label: string) =>
  z.string(`${label} không hợp lệ`).regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${label} phải có dạng HH:mm`);

const count = (label: string, min: number) =>
  z.int32(`${label} phải là số nguyên`).min(min, min === 0 ? `${label} không được âm` : `${label} phải lớn hơn 0`);

export const updateSettingsBodySchema = z
  .object({
    openTime: timeSchema('Giờ mở cửa'),
    closeTime: timeSchema('Giờ đóng cửa'),
    slotDurationMinutes: count('Thời lượng slot', 1),
    maxAdvanceBookingDays: count('Số ngày đặt trước', 0),
    bookingCancelDeadlineHours: count('Hạn hủy booking', 0),
    courseCancelDeadlineDays: count('Hạn hủy khóa học', 0),
    membershipExpiryWarningDays: count('Số ngày nhắc gói hết hạn', 0),
    topUpMinAmount: z
      .int('Số tiền nạp tối thiểu phải là số nguyên')
      .min(1, 'Số tiền nạp tối thiểu phải lớn hơn 0')
      .max(MAX_MONEY, 'Số tiền nạp tối thiểu quá lớn'),
    invoiceExpiryMinutes: count('Thời hạn hóa đơn', 1),
  })
  .partial()
  .refine(({ openTime, closeTime }) => !openTime || !closeTime || openTime < closeTime, {
    path: ['closeTime'],
    message: 'Giờ đóng cửa phải sau giờ mở cửa',
  });

export type UpdateSettingsBody = z.infer<typeof updateSettingsBodySchema>;
