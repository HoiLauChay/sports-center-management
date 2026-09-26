import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import express, { type ErrorRequestHandler } from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { pageQuerySchema } from '@sports-center/shared';
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
  test('replaces req.query with the parsed values', async () => {
    const res = await fetch(`${baseUrl}/items?page=2&limit=5`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ page: 2, limit: 5 });
  });

  test('applies defaults for missing values', async () => {
    const res = await fetch(`${baseUrl}/items`);
    expect(await res.json()).toEqual({ page: 1, limit: 20 });
  });

  test('responds 422 when limit exceeds the maximum', async () => {
    const res = await fetch(`${baseUrl}/items?limit=101`);
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string; errors: { path: string }[] };
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.errors.map(({ path }) => path)).toEqual(['query.limit']);
  });
});
