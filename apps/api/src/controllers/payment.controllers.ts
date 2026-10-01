import type { SepayWebhookBody } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { fromSepayWebhook } from '~/mappers/bankTransaction.mapper';
import bankTransactionService from '~/services/bankTransaction.service';

class PaymentController {
  sepayWebhook = async (req: Request, res: Response) => {
    const body = req.body as SepayWebhookBody;
    if (body.transferType === 'in' && body.transferAmount > 0) {
      await bankTransactionService.ingest(fromSepayWebhook(body));
    }
    res.status(HTTP_STATUS.OK).json({ success: true });
  };
}

export default new PaymentController();
