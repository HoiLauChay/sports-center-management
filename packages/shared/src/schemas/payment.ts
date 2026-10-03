import { z } from 'zod';

import { BANK_TRANSACTION_STATUSES } from '../constants/enums';
import { pageQuerySchema } from './pagination';

export const sepayWebhookBodySchema = z.looseObject({
  id: z.int(),
  gateway: z.string(),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
  accountNumber: z.string(),
  content: z.string(),
  transferType: z.enum(['in', 'out']),
  transferAmount: z.int().min(0),
  referenceCode: z.string().nullish(),
});

export type SepayWebhookBody = z.infer<typeof sepayWebhookBodySchema>;

const MAX_RECONCILIATION_DAYS = 31;
const dayMs = 24 * 60 * 60 * 1000;
const noteSchema = z
  .string('Ghi chú không được để trống')
  .trim()
  .min(1, 'Ghi chú không được để trống')
  .max(500, 'Ghi chú tối đa 500 ký tự');

export const listBankTransactionsQuerySchema = pageQuerySchema
  .extend({
    status: z.enum(BANK_TRANSACTION_STATUSES, 'Trạng thái không hợp lệ').optional(),
    from: z.iso.date('Ngày bắt đầu không hợp lệ').optional(),
    to: z.iso.date('Ngày kết thúc không hợp lệ').optional(),
    q: z.string().trim().min(1).max(100).optional(),
  })
  .refine(({ from, to }) => !from || !to || from <= to, {
    path: ['to'],
    message: 'Ngày kết thúc phải từ ngày bắt đầu trở đi',
  });

export const bankTransactionIdParamsSchema = z.object({ id: z.uuid('Mã giao dịch không hợp lệ') });

export const resolveBankTransactionBodySchema = z.object({
  accountId: z.uuid('Mã thành viên không hợp lệ'),
  note: noteSchema,
});

export const ignoreBankTransactionBodySchema = z.object({ note: noteSchema });

export const reconciliationQuerySchema = z
  .object({
    from: z.iso.date('Ngày bắt đầu không hợp lệ'),
    to: z.iso.date('Ngày kết thúc không hợp lệ'),
  })
  .refine(({ from, to }) => from <= to, { path: ['to'], message: 'Ngày kết thúc phải từ ngày bắt đầu trở đi' })
  .refine(({ from, to }) => (Date.parse(to) - Date.parse(from)) / dayMs < MAX_RECONCILIATION_DAYS, {
    path: ['to'],
    message: `Chỉ đối soát tối đa ${MAX_RECONCILIATION_DAYS} ngày`,
  });

export type ListBankTransactionsQuery = z.infer<typeof listBankTransactionsQuerySchema>;
export type ResolveBankTransactionBody = z.infer<typeof resolveBankTransactionBodySchema>;
export type IgnoreBankTransactionBody = z.infer<typeof ignoreBankTransactionBodySchema>;
export type ReconciliationQuery = z.infer<typeof reconciliationQuerySchema>;
