import type { SepayWebhookBody } from '@sports-center/shared';

import type { Prisma } from '~/generated/prisma/client';
import type { IncomingBankTransaction } from '~/services/bankTransaction.service';

export const fromSepayWebhook = (body: SepayWebhookBody): IncomingBankTransaction => ({
  sepayId: BigInt(body.id),
  bankName: body.gateway,
  accountNumber: body.accountNumber,
  amount: body.transferAmount,
  content: body.content,
  referenceCode: body.referenceCode || null,
  transactionDate: new Date(`${body.transactionDate.replace(' ', 'T')}+07:00`),
  rawPayload: body as Prisma.InputJsonObject,
});
