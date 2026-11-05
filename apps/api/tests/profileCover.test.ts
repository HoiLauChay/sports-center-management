import type { Account } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { resetDatabase } from './helpers/db';
import { createAccount, readCode, readResult, startServer } from './helpers/http';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];

beforeAll(async () => {
  ({ server, request } = await startServer('/auth'));
});

afterAll(() => server.close());

beforeEach(async () => {
  await resetDatabase();
});

const COVER = 'https://example.com/covers/cover.jpg';

describe('profile cover image', () => {
  test.each(['MEMBER', 'COACH', 'RECEPTIONIST'] as const)('a %s account carries its own cover image', async (role) => {
    const account = await createAccount(role, `${role.toLowerCase()}@example.com`);
    await prisma.account.update({ where: { id: account.id }, data: { coverImageUrl: COVER } });

    const me = await readResult<Account>(await request('GET', '/me', account));
    expect(me.coverImageUrl).toBe(COVER);

    const kept = await request('PATCH', '/me', account, { coverImageUrl: COVER, fullName: 'Tên Mới' });
    expect(kept.status).toBe(200);

    const removed = await readResult<Account>(await request('PATCH', '/me', account, { coverImageUrl: null }));
    expect(removed.coverImageUrl).toBeNull();
  });

  test('a cover that was not uploaded through the system is rejected', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');

    const response = await request('PATCH', '/me', member, { coverImageUrl: 'https://evil.example/cover.jpg' });
    expect([response.status, await readCode(response)]).toEqual([422, 'VALIDATION_ERROR']);
    expect((await prisma.account.findUniqueOrThrow({ where: { id: member.id } })).coverImageUrl).toBeNull();
  });
});
