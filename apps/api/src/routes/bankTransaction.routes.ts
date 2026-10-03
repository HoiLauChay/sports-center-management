import {
  bankTransactionIdParamsSchema,
  ignoreBankTransactionBodySchema,
  listBankTransactionsQuerySchema,
  reconciliationQuerySchema,
  resolveBankTransactionBodySchema,
} from '@sports-center/shared';
import { Router } from 'express';

import bankTransactionController from '~/controllers/bankTransaction.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

const bankTransactionRouter = Router();

bankTransactionRouter.use(auth, isRole('MANAGER'));
bankTransactionRouter.get('/', validate({ query: listBankTransactionsQuerySchema }), bankTransactionController.list);
bankTransactionRouter.get(
  '/reconciliation',
  validate({ query: reconciliationQuerySchema }),
  bankTransactionController.reconcile,
);
bankTransactionRouter.post(
  '/:id/resolve',
  validate({ params: bankTransactionIdParamsSchema, body: resolveBankTransactionBodySchema }),
  bankTransactionController.resolve,
);
bankTransactionRouter.post(
  '/:id/ignore',
  validate({ params: bankTransactionIdParamsSchema, body: ignoreBankTransactionBodySchema }),
  bankTransactionController.ignore,
);

export default bankTransactionRouter;
