import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import app from '~/app';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(() => server.close());

describe('error handler', () => {
  test('malformed JSON body responds 400 INVALID_JSON', async () => {
    const res = await fetch(`${baseUrl}/api/v1/wallet/top-ups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: "'{amount:50000}'",
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ status: false, code: 'INVALID_JSON' });
  });
});
