import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';

import { isProduction } from '~/configs/env';
import { defaultErrorHandler, notFoundHandler } from '~/middlewares/error.middlewares';
import { sameOriginJsonWrites } from '~/middlewares/security.middlewares';
import docsRouter from '~/routes/docs.routes';
import rootRouter from '~/routes/root.routes';

const app = express();

app.use(helmet());
app.use(sameOriginJsonWrites);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

if (!isProduction) app.use('/api/v1/docs', docsRouter);
app.use('/api/v1', rootRouter);

app.use(notFoundHandler);
app.use(defaultErrorHandler);

export default app;
