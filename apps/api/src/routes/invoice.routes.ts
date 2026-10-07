import { invoiceIdParamsSchema, listMyInvoicesQuerySchema } from '@sports-center/shared';
import { Router } from 'express';

import invoiceController from '~/controllers/invoice.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

export const myInvoiceRouter = Router();
myInvoiceRouter.use(auth, isRole('MEMBER'));
myInvoiceRouter.get('/', validate({ query: listMyInvoicesQuerySchema }), invoiceController.listMine);

export const invoiceRouter = Router();
invoiceRouter.use(auth, isRole('MEMBER', 'RECEPTIONIST', 'MANAGER'));
invoiceRouter.get('/:id', validate({ params: invoiceIdParamsSchema }), invoiceController.getById);
invoiceRouter.post(
  '/:id/cancel',
  isRole('RECEPTIONIST'),
  validate({ params: invoiceIdParamsSchema }),
  invoiceController.cancel,
);
