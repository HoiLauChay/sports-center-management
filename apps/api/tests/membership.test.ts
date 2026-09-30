import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { resetDatabase } from './helpers/db';
import type { buildFetcher } from './helpers/http';
import { createAccount, readResult, startServer } from './helpers/http';

let server: Server;
let req: ReturnType<typeof buildFetcher>;

beforeAll(async () => {
  const s = await startServer('/memberships');
  server = s.server;
  req = s.request;
});

afterAll(() => server.close());
beforeEach(resetDatabase);
afterEach(() => mock.restore());

interface PkgResult {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationDays: number;
  gymAccess: boolean;
  bookingDiscountPct: number;
  classDiscountPct: number;
  freeBookingSlotsPerMonth: number;
  isActive: boolean;
}

const validBody = {
  name: 'Gói Tháng',
  price: 500000,
  durationDays: 30,
  gymAccess: true,
  bookingDiscountPct: 10,
  classDiscountPct: 5,
  freeBookingSlotsPerMonth: 4,
};

describe('membership crud', () => {
  test('manager creates, updates, lists and deletes; member only sees active ones', async () => {
    const manager = await createAccount('MANAGER', 'mgr@example.com');
    const member = await createAccount('MEMBER', 'mem@example.com');

    const res = await req('POST', '/', manager, validBody);
    expect(res.status).toBe(201);
    const pkg = await readResult<PkgResult>(res);
    expect(pkg).toMatchObject({ name: 'Gói Tháng', price: 500000, durationDays: 30, gymAccess: true, isActive: true });

    const updateRes = await req('PATCH', `/${pkg.id}`, manager, { isActive: false });
    expect(updateRes.status).toBe(200);
    expect(await readResult<PkgResult>(updateRes)).toMatchObject({ name: 'Gói Tháng', isActive: false });

    const managerList = await readResult<PkgResult[]>(await req('GET', '/', manager));
    expect(managerList).toHaveLength(1);

    const memberList = await readResult<PkgResult[]>(await req('GET', '/', member));
    expect(memberList).toHaveLength(0);

    const delRes = await req('DELETE', `/${pkg.id}`, manager);
    expect(delRes.status).toBe(200);
    expect(await readResult<PkgResult[]>(await req('GET', '/', manager))).toHaveLength(0);

    expect(await prisma.auditLog.count({ where: { entityType: 'MEMBERSHIP' } })).toBe(3);
  });

  test('invalid discount pct returns 422', async () => {
    const manager = await createAccount('MANAGER', 'mgr@example.com');
    const res = await req('POST', '/', manager, { ...validBody, bookingDiscountPct: 101 });
    expect(res.status).toBe(422);
  });

  test('deactivating notifies auto-renew members', async () => {
    const manager = await createAccount('MANAGER', 'mgr@example.com');
    const member = await createAccount('MEMBER', 'mem@example.com');

    const pkg = await readResult<PkgResult>(await req('POST', '/', manager, validBody));

    await prisma.memberMembership.create({
      data: {
        accountId: member.id,
        packageId: pkg.id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 86_400_000),
        autoRenew: true,
        status: 'ACTIVE',
      },
    });

    await req('PATCH', `/${pkg.id}`, manager, { isActive: false });

    const notifications = await prisma.notification.findMany({ where: { accountId: member.id } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toContain('ngừng bán');
  });
});
