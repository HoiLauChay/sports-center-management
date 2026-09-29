import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { resetDatabase } from './helpers/db';
import type { buildFetcher } from './helpers/http';
import { createAccount, readCode, readResult, startServer } from './helpers/http';

let server: Server;
let request: ReturnType<typeof buildFetcher>;

beforeAll(async () => {
  ({ server, request } = await startServer('/audit-logs'));
});

afterAll(() => server.close());
beforeEach(resetDatabase);

interface Page {
  items: { id: string; account: { id: string; fullName: string } | null; entityType: string }[];
  nextCursor: string | null;
}

describe('GET /audit-logs', () => {
  test('requires a date range, filters and pages by cursor for managers only', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');

    const base = { accountId: manager.id, action: 'UPDATE', entityId: 'x' };
    await prisma.auditLog.createMany({
      data: [
        { ...base, entityType: 'ACCOUNT', createdAt: new Date('2026-09-10T03:00:00Z') },
        { ...base, entityType: 'ACCOUNT', createdAt: new Date('2026-09-11T03:00:00Z') },
        { ...base, entityType: 'SPORT', createdAt: new Date('2026-09-12T03:00:00Z') },
        { ...base, entityType: 'ACCOUNT', createdAt: new Date('2026-10-01T03:00:00Z') },
      ],
    });

    const missing = await request('GET', '/?from=2026-09-01', manager);
    expect(missing.status).toBe(422);
    expect(await readCode(missing)).toBe('VALIDATION_ERROR');

    expect((await request('GET', '/?from=2026-09-01&to=2026-09-30', receptionist)).status).toBe(403);

    const first = await readResult<Page>(
      await request('GET', '/?from=2026-09-01&to=2026-09-30&entityType=ACCOUNT&limit=1', manager),
    );
    expect(first.items).toHaveLength(1);
    expect(first.items[0]?.account).toEqual({ id: manager.id, fullName: 'MANAGER' });
    expect(first.nextCursor).not.toBeNull();

    const second = await readResult<Page>(
      await request(
        'GET',
        `/?from=2026-09-01&to=2026-09-30&entityType=ACCOUNT&limit=1&cursor=${first.nextCursor}`,
        manager,
      ),
    );
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
  });
});
