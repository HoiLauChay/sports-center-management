import { walletQuerySchema } from '@sports-center/shared';
import { Router } from 'express';

import walletController from '~/controllers/wallet.controllers';
import { auth, isRole } from '~/middlewares/auth.middlewares';
import { validate } from '~/utils/validation';

export const myWalletRouter = Router();
myWalletRouter.use(auth, isRole('MEMBER'));
myWalletRouter.get('/', validate({ query: walletQuerySchema }), walletController.getMine);
