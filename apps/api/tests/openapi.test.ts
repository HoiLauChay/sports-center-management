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

describe('OpenAPI docs', () => {
  test('spec is generated from routers with schemas, roles and security', async () => {
    const response = await fetch(`${baseUrl}/api/v1/docs/openapi.json`);
    expect(response.status).toBe(200);
    const { paths } = (await response.json()) as { paths: Record<string, Record<string, Record<string, unknown>>> };

    expect(paths['/wallet/top-ups']?.post).toMatchObject({
      tags: ['wallet'],
      description: 'Vai trò: MEMBER, RECEPTIONIST',
      security: [{ cookie: [] }],
      requestBody: { content: { 'application/json': { schema: { required: ['amount'] } } } },
    });
    expect(paths['/users/{id}/wallet']?.get?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'id', in: 'path', required: true }),
        expect.objectContaining({ name: 'page', in: 'query', required: false }),
      ]),
    );
    expect(paths['/payments/sepay/webhook']?.post?.security).toEqual([{ sepay: [] }]);
    expect(paths['/auth/login']?.post?.security).toBeUndefined();
    expect(paths['/sessions/{id}']?.patch).toMatchObject({
      tags: ['sessions'],
      description: 'Vai trò: MANAGER',
      security: [{ cookie: [] }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              properties: {
                date: { type: 'string', format: 'date' },
                facilityId: { type: 'string', format: 'uuid' },
              },
            },
          },
        },
      },
    });
  });
});
