import { z } from 'zod';

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
