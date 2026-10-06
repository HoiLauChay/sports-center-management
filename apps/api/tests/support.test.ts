import type { Paginated, SupportRequest } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { resetDatabase } from './helpers/db';
import { createAccount, readCode, readResult, startServer } from './helpers/http';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];

beforeAll(async () => {
  ({ server, request } = await startServer(''));
});

afterAll(() => server.close());

beforeEach(resetDatabase);

const ticket = { category: 'PAYMENT', subject: 'Chưa nhận được tiền nạp', description: 'Đã chuyển khoản lúc 9h' };

describe('support requests', () => {
  test('a member only sees own tickets; staff list them by member and status', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const other = await createAccount('MEMBER', 'other@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');

    const created = await request('POST', '/support-requests', member, ticket);
    expect(created.status).toBe(201);
    const mine = await readResult<SupportRequest>(created);
    expect(mine).toMatchObject({ account: { id: member.id }, status: 'OPEN', handledBy: null });
    await request('POST', '/support-requests', other, ticket);

    expect(await readResult<SupportRequest[]>(await request('GET', '/me/support-requests', member))).toHaveLength(1);
    expect((await request('GET', `/support-requests/${mine.id}`, other)).status).toBe(404);
    const page = await readResult<Paginated<SupportRequest>>(
      await request('GET', `/support-requests?accountId=${member.id}&status=OPEN`, receptionist),
    );
    expect(page.items.map(({ id }) => id)).toEqual([mine.id]);
  });

  test('status only moves forward, may skip ahead, needs a reply to resolve and notifies the member once per step', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    const { id } = await readResult<SupportRequest>(await request('POST', '/support-requests', member, ticket));
    const patch = (body: unknown) => request('PATCH', `/support-requests/${id}`, receptionist, body);

    expect((await patch({ status: 'RESOLVED' })).status).toBe(422);
    const resolved = await readResult<SupportRequest>(
      await patch({ status: 'RESOLVED', resolutionNote: 'Đã cộng tiền vào ví' }),
    );
    expect(resolved).toMatchObject({ status: 'RESOLVED', handledBy: { id: receptionist.id } });
    expect(resolved.resolvedAt).not.toBeNull();

    const back = await patch({ status: 'IN_PROGRESS' });
    expect([back.status, await readCode(back)]).toEqual([409, 'INVALID_STATE']);
    const repeats = await Promise.all([1, 2].map(() => patch({ status: 'CLOSED' })));
    expect(repeats.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect((await patch({ resolutionNote: 'Bổ sung' })).status).toBe(409);

    expect(await prisma.notification.count({ where: { accountId: member.id, type: 'SUPPORT' } })).toBe(2);
    expect(await prisma.auditLog.count()).toBe(0);
  });
});
