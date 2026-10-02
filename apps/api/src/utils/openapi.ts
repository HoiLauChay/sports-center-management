import type { RequestHandler, Router } from 'express';
import { z } from 'zod';

import { COOKIE } from '~/constants/auth';
import { readHandlerMeta, type RouteMeta } from '~/utils/routeMeta';

interface JsonSchema {
  properties?: Record<string, JsonSchema>;
  required?: string[];
  [key: string]: unknown;
}

interface RouterLayer {
  handle: RequestHandler;
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: RequestHandler }[] };
}

const SECURITY_SCHEMES = {
  cookie: { type: 'apiKey', in: 'cookie', name: COOKIE.ACCESS_TOKEN },
  sepay: { type: 'apiKey', in: 'header', name: 'Authorization', description: 'Apikey <SEPAY_WEBHOOK_API_KEY>' },
  cron: { type: 'http', scheme: 'bearer', description: 'CRON_SECRET' },
} as const;

const toJsonSchema = (schema: z.ZodType) => {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JsonSchema;
  delete json.$schema;
  return json;
};

const mergeMeta = (base: RouteMeta, next: RouteMeta | undefined): RouteMeta =>
  next ? { ...base, ...next, schemas: { ...base.schemas, ...next.schemas } } : base;

const toParameters = (location: 'path' | 'query', schema: z.ZodType | undefined) => {
  if (!schema) return [];
  const { properties = {}, required = [] } = toJsonSchema(schema);
  return Object.entries(properties).map(([name, property]) => ({
    name,
    in: location,
    required: location === 'path' || required.includes(name),
    schema: property,
  }));
};

const toOperation = (tag: string, path: string, handler: RequestHandler, meta: RouteMeta) => {
  const { body, query, params } = meta.schemas ?? {};
  const pathParameters = toParameters('path', params);
  for (const [, name = ''] of path.matchAll(/\{(\w+)\}/g)) {
    if (!pathParameters.some((parameter) => parameter.name === name)) {
      pathParameters.push({ name, in: 'path', required: true, schema: { type: 'string' } });
    }
  }

  return {
    tags: [tag],
    summary: handler.name,
    ...(meta.roles && { description: `Vai trò: ${meta.roles.join(', ')}` }),
    ...(meta.security && { security: [{ [meta.security]: [] }] }),
    parameters: [...pathParameters, ...toParameters('query', query)],
    ...(body && { requestBody: { required: true, content: { 'application/json': { schema: toJsonSchema(body) } } } }),
    responses: { default: { description: 'ResponseClient' } },
  };
};

export const buildOpenApiDocument = (routes: [string, Router][]) => {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const [prefix, router] of routes) {
    const tag = prefix.slice(1);
    let inherited: RouteMeta = {};

    for (const layer of (router as unknown as { stack: RouterLayer[] }).stack) {
      if (!layer.route) {
        inherited = mergeMeta(inherited, readHandlerMeta(layer.handle));
        continue;
      }

      const { stack, methods } = layer.route;
      const meta = stack.reduce((acc, { handle }) => mergeMeta(acc, readHandlerMeta(handle)), inherited);
      const path = `${prefix}${layer.route.path === '/' ? '' : layer.route.path}`.replace(/:(\w+)/g, '{$1}');

      for (const method of Object.keys(methods)) {
        paths[path] = { ...paths[path], [method]: toOperation(tag, path, stack.at(-1)!.handle, meta) };
      }
    }
  }

  return {
    openapi: '3.1.0',
    info: { title: 'Sports Center Management API', version: '1.0.0' },
    servers: [{ url: '/api/v1' }],
    paths,
    components: { securitySchemes: SECURITY_SCHEMES },
  };
};
