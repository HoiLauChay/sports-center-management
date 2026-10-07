import { z } from 'zod';

import { INVOICE_PURPOSES, INVOICE_STATUSES, WALLET_TRANSACTION_TYPES } from '../constants/enums';
import { MAX_MONEY } from '../constants/money';
import { pageQuerySchema } from './pagination';

export const walletQuerySchema = pageQuerySchema.extend({
  type: z.enum(WALLET_TRANSACTION_TYPES, 'Loại giao dịch không hợp lệ').optional(),
});

export const createTopUpBodySchema = z.object({
  accountId: z.uuid('Mã thành viên không hợp lệ').optional(),
  amount: z.int('Số tiền phải là số nguyên').min(1, 'Số tiền phải lớn hơn 0').max(MAX_MONEY, 'Số tiền quá lớn'),
});

export const counterTopUpBodySchema = z.object({
  amount: z.int('Số tiền phải là số nguyên').min(1, 'Số tiền phải lớn hơn 0').max(MAX_MONEY, 'Số tiền quá lớn'),
  method: z.enum(['CASH', 'CARD'], 'Phương thức không hợp lệ'),
  note: z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự').optional(),
  idempotencyKey: z
    .string('Thiếu khóa chống gửi lặp')
    .trim()
    .min(8, 'Khóa chống gửi lặp quá ngắn')
    .max(100, 'Khóa chống gửi lặp quá dài'),
});

export const listMyInvoicesQuerySchema = pageQuerySchema.extend({
  purpose: z.enum(INVOICE_PURPOSES, 'Loại hóa đơn không hợp lệ').optional(),
  status: z.enum(INVOICE_STATUSES, 'Trạng thái không hợp lệ').optional(),
});

export const invoiceIdParamsSchema = z.object({ id: z.uuid('Mã hóa đơn không hợp lệ') });

export type WalletQuery = z.infer<typeof walletQuerySchema>;
export type CreateTopUpBody = z.infer<typeof createTopUpBodySchema>;
export type CounterTopUpBody = z.infer<typeof counterTopUpBodySchema>;
export type ListMyInvoicesQuery = z.infer<typeof listMyInvoicesQuerySchema>;
