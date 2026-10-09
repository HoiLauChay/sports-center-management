import { checkoutBodySchema, checkoutQuoteBodySchema, counterInvoiceBodySchema } from '@sports-center/shared';
import { Router } from 'express';

import checkoutController from '~/controllers/checkout.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const checkoutRouter = Router();

checkoutRouter.use(auth, isRole('MEMBER', 'RECEPTIONIST'));
checkoutRouter.post('/', validate({ body: checkoutBodySchema }), checkoutController.checkout);
checkoutRouter.post(
  '/invoices',
  isRole('RECEPTIONIST'),
  validate({ body: counterInvoiceBodySchema }),
  checkoutController.createInvoice,
);
checkoutRouter.post('/quote', validate({ body: checkoutQuoteBodySchema }), checkoutController.quote);

export default checkoutRouter;
