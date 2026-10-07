import { z } from 'zod';

import { MAX_MONEY } from '../constants/money';
import { phoneSchema } from './account';
import { timeOfDaySchema as timeSchema } from './time';

const dateSchema = z.iso.date('Ngày không hợp lệ');
const facilityIdSchema = z.uuid('Mã cơ sở không hợp lệ');

const packageFields = {
  facilityId: facilityIdSchema,
  startDate: dateSchema,
  daysOfWeek: z
    .array(z.int('Thứ không hợp lệ').min(0, 'Thứ không hợp lệ').max(6, 'Thứ không hợp lệ'))
    .min(1, 'Chọn ít nhất một thứ')
    .refine((days) => new Set(days).size === days.length, 'Thứ bị trùng'),
  startTime: timeSchema,
  endTime: timeSchema,
  weeks: z.int('Số tuần phải là số nguyên').min(1, 'Số tuần tối thiểu là 1').max(52, 'Số tuần tối đa là 52'),
};

export const facilityPackagePreviewBodySchema = z.object(packageFields);

export const checkoutItemInputSchema = z.discriminatedUnion(
  'type',
  [
    z.object({
      type: z.literal('FACILITY_BOOKING'),
      facilityId: facilityIdSchema,
      date: dateSchema,
      startTime: timeSchema,
      endTime: timeSchema,
    }),
    z.object({ type: z.literal('FACILITY_PACKAGE'), ...packageFields }),
    z.object({ type: z.literal('COURSE_ENROLLMENT'), classId: z.uuid('Mã lớp không hợp lệ') }),
    z.object({ type: z.literal('MEMBERSHIP'), packageId: z.uuid('Mã gói không hợp lệ') }),
  ],
  'Loại dòng không hợp lệ',
);

export const checkoutBuyerSchema = z.union(
  [
    z.object({ accountId: z.uuid('Mã thành viên không hợp lệ') }),
    z.object({
      guest: z.object({
        name: z.string('Tên khách không được để trống').trim().min(1, 'Tên khách không được để trống').max(255),
        phone: phoneSchema.refine((phone) => phone !== null, 'Số điện thoại không được để trống'),
      }),
    }),
  ],
  'Người mua không hợp lệ',
);

export const checkoutQuoteBodySchema = z.object({
  buyer: checkoutBuyerSchema.optional(),
  items: z
    .array(checkoutItemInputSchema, 'Danh sách dòng không hợp lệ')
    .min(1, 'Đơn phải có ít nhất một dòng')
    .max(20, 'Đơn tối đa 20 dòng'),
  couponCode: z.string().trim().toUpperCase().min(1, 'Mã giảm giá không hợp lệ').max(50).optional(),
});

const expectedTotalSchema = z
  .int('Tổng tiền phải là số nguyên')
  .min(0, 'Tổng tiền không được âm')
  .max(MAX_MONEY, 'Tổng tiền quá lớn');

export const checkoutBodySchema = checkoutQuoteBodySchema.extend({
  paymentMethod: z.enum(['WALLET', 'CASH', 'CARD'], 'Phương thức thanh toán không hợp lệ'),
  expectedTotal: expectedTotalSchema,
  idempotencyKey: z
    .string('Thiếu khóa chống gửi lặp')
    .trim()
    .min(8, 'Khóa chống gửi lặp quá ngắn')
    .max(100, 'Khóa chống gửi lặp quá dài'),
});

export const counterInvoiceBodySchema = checkoutQuoteBodySchema.extend({
  buyer: checkoutBuyerSchema,
  expectedTotal: expectedTotalSchema,
});

export type CheckoutItemInput = z.infer<typeof checkoutItemInputSchema>;
export type CheckoutBuyer = z.infer<typeof checkoutBuyerSchema>;
export type CheckoutQuoteBody = z.infer<typeof checkoutQuoteBodySchema>;
export type CheckoutBody = z.infer<typeof checkoutBodySchema>;
export type FacilityPackagePreviewBody = z.infer<typeof facilityPackagePreviewBodySchema>;
export type CounterInvoiceBody = z.infer<typeof counterInvoiceBodySchema>;
