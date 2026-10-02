import { Router } from 'express';

import { apiRoutes } from '~/routes/root.routes';
import { buildOpenApiDocument } from '~/utils/openapi';

const SWAGGER_UI = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.33.1';

const PAGE = `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <title>Sports Center API</title>
    <link rel="stylesheet" href="${SWAGGER_UI}/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${SWAGGER_UI}/swagger-ui-bundle.js"></script>
    <script src="./init.js"></script>
  </body>
</html>`;

const INIT = `SwaggerUIBundle({
  url: './openapi.json',
  dom_id: '#swagger-ui',
  persistAuthorization: true,
  tryItOutEnabled: true,
  displayRequestDuration: true,
});`;

const CSP = [
  "default-src 'self'",
  `script-src 'self' ${SWAGGER_UI}/`,
  `style-src 'self' 'unsafe-inline' ${SWAGGER_UI}/`,
  "img-src 'self' data:",
  "connect-src 'self'",
].join('; ');

const docsRouter = Router();
let spec: ReturnType<typeof buildOpenApiDocument> | undefined;

docsRouter.get('/', (req, res) => {
  if (!req.originalUrl.endsWith('/')) return res.redirect(`${req.originalUrl}/`);
  res.setHeader('Content-Security-Policy', CSP);
  res.type('html').send(PAGE);
});
docsRouter.get('/init.js', (_req, res) => {
  res.type('js').send(INIT);
});
docsRouter.get('/openapi.json', (_req, res) => {
  spec ??= buildOpenApiDocument(apiRoutes);
  res.json(spec);
});

export default docsRouter;
