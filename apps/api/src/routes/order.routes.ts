import {
  listMyOrdersQuerySchema,
  listOrdersQuerySchema,
  orderIdParamsSchema,
  refundReceiptParamsSchema,
} from '@sports-center/shared';
import { Router } from 'express';

import orderController from '~/controllers/order.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

export const myOrderRouter = Router();
myOrderRouter.use(auth, isRole('MEMBER'));
myOrderRouter.get('/', validate({ query: listMyOrdersQuerySchema }), orderController.listMine);

export const orderRouter = Router();
orderRouter.use(auth);
orderRouter.get(
  '/',
  isRole('RECEPTIONIST', 'MANAGER'),
  validate({ query: listOrdersQuerySchema }),
  orderController.list,
);
orderRouter.use(isRole('MEMBER', 'RECEPTIONIST', 'MANAGER'));
orderRouter.get('/:id', validate({ params: orderIdParamsSchema }), orderController.getById);
orderRouter.get('/:id/receipt', validate({ params: orderIdParamsSchema }), orderController.paymentReceipt);
orderRouter.get(
  '/:id/refunds/:transactionId/receipt',
  validate({ params: refundReceiptParamsSchema }),
  orderController.refundReceipt,
);
