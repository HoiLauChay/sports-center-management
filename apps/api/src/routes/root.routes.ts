import { Router } from 'express';

import authRouter from '~/routes/auth.routes';
import uploadRouter from '~/routes/upload.routes';
import { ResponseClient } from '~/rules/response';

const rootRouter = Router();

rootRouter.get('/health', (_req, res) => {
  res.json(new ResponseClient({ message: 'OK' }));
});

rootRouter.use('/auth', authRouter);
rootRouter.use('/uploads', uploadRouter);

export default rootRouter;
