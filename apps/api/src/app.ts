import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';

import { defaultErrorHandler, notFoundHandler } from '~/middlewares/error.middlewares';
import rootRouter from '~/routes/root.routes';

const app = express();

app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api/v1', rootRouter);

app.use(notFoundHandler);
app.use(defaultErrorHandler);

export default app;
