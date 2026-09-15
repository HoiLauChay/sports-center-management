import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env, isProduction } from '~/configs/env';
import { defaultErrorHandler, notFoundHandler } from '~/middlewares/error.middlewares';
import rootRouter from '~/routes/root.routes';

const app = express();

if (isProduction) app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api/v1', rootRouter);

app.use(notFoundHandler);
app.use(defaultErrorHandler);

app.listen(env.PORT, () => {
  console.warn(`✓ Server running on http://localhost:${env.PORT}`);
});
