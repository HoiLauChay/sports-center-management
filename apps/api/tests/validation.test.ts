import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import express, { type ErrorRequestHandler } from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import * as shared from '@sports-center/shared';
import { pageQuerySchema } from '@sports-center/shared';
import { ZodObject } from 'zod';
import { ErrorWithStatus } from '~/rules/error';
import { validate } from '~/utils/validation';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.get('/items', validate({ query: pageQuerySchema }), (req, res) => {
    res.json(req.query);
  });
  const handleError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (!(err instanceof ErrorWithStatus)) throw err;
    res.status(err.status).json({ code: err.code, errors: err.errors });
  };
  app.use(handleError);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

describe('validate query', () => {
  test('replaces req.query with the parsed values and defaults', async () => {
    const res = await fetch(`${baseUrl}/items?page=2`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ page: 2, limit: 20 });
  });

  test('responds 422 when limit exceeds the maximum', async () => {
    const res = await fetch(`${baseUrl}/items?limit=101`);
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string; errors: { path: string }[] };
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.errors.map(({ path }) => path)).toEqual(['query.limit']);
  });
});

describe('update body schemas', () => {
  const updateSchemas = Object.entries(shared as Record<string, unknown>).filter(
    (entry): entry is [string, ZodObject] => /^update.*Schema$/.test(entry[0]) && entry[1] instanceof ZodObject,
  );

  test('never fill in omitted fields, so a partial update cannot overwrite stored values', () => {
    expect(updateSchemas.length).toBeGreaterThan(0);
    const filled = updateSchemas.flatMap(([name, schema]) =>
      Object.entries(schema.shape)
        .filter(([, field]) => {
          const parsed = field.safeParse(undefined);
          return parsed.success && parsed.data !== undefined;
        })
        .map(([key]) => `${name}.${key}`),
    );
    expect(filled).toEqual([]);
  });
});
