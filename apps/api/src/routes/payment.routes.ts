import { sepayWebhookBodySchema } from '@sports-center/shared';
import { Router } from 'express';

import paymentController from '~/controllers/payment.controllers';
import { sepayAuth } from '~/middlewares/payment.middlewares';
import { validate } from '~/utils/validation';

const paymentRouter = Router();

paymentRouter.post(
  '/sepay/webhook',
  sepayAuth,
  validate({ body: sepayWebhookBodySchema }),
  paymentController.sepayWebhook,
);

export default paymentRouter;
