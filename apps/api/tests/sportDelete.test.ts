import type { SportDeletionImpact } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { addDays, todayInCenter } from '~/utils/time';
import { seedOpenClass } from './helpers/class';
import { resetDatabase } from './helpers/db';
import { buildFetcher, createAccount, readCode, startServer } from './helpers/http';
import { expectWalletConsistent, seedBalance } from './helpers/wallet';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];
let checkout: ReturnType<typeof buildFetcher>;

beforeAll(async () => {
  ({ server, request } = await startServer('/sports'));
  checkout = buildFetcher(`http://localhost:${(server.address() as { port: number }).port}/api/v1/checkout`);
});

afterAll(() => server.close());

beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
});

const sportOf = async (classId: string) =>
  (await prisma.class.findUniqueOrThrow({ where: { id: classId }, include: { course: true } })).course.sportId;

describe('delete sport', () => {
  test('classes not yet started are listed first, then cancelled and refunded on confirmation', async () => {
    const cls = await seedOpenClass();
    const sportId = await sportOf(cls.id);
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const members = await Promise.all(
      ['a@example.com', 'b@example.com'].map((email) => createAccount('MEMBER', email)),
    );
    for (const [index, member] of members.entries()) {
      await seedBalance(member.id, 300_000);
      const paid = await checkout('POST', '/', member, {
        items: [{ type: 'COURSE_ENROLLMENT', classId: cls.id }],
        paymentMethod: 'WALLET',
        expectedTotal: 300_000,
        idempotencyKey: `enroll-before-delete-${index}`,
      });
      expect(paid.status).toBe(201);
    }

    const first = await request('DELETE', `/${sportId}`, manager);
    expect(first.status).toBe(409);
    const impact = (await first.json()) as SportDeletionImpact & { code: string };
    expect(impact).toMatchObject({
      code: 'CONFIRMATION_REQUIRED',
      refundTotal: 600_000,
      affectedClasses: [{ id: cls.id, status: 'OPEN', students: 2 }],
    });
    expect(await prisma.sport.findUniqueOrThrow({ where: { id: sportId } })).toMatchObject({ deletedAt: null });

    expect((await request('DELETE', `/${sportId}?confirm=true`, manager)).status).toBe(200);
    expect((await prisma.sport.findUniqueOrThrow({ where: { id: sportId } })).deletedAt).not.toBeNull();
    expect((await prisma.class.findUniqueOrThrow({ where: { id: cls.id } })).status).toBe('CANCELLED');
    expect(await prisma.classEnrollment.count({ where: { status: 'ENROLLED' } })).toBe(0);
    for (const member of members) expect(await expectWalletConsistent(member.id)).toBe(300_000);
    expect((await request('DELETE', `/${sportId}?confirm=true`, manager)).status).toBe(404);
  });

  test('a class already under way blocks deletion even when confirmed', async () => {
    const cls = await seedOpenClass({ startDate: addDays(todayInCenter(), -2) });
    const manager = await createAccount('MANAGER', 'manager@example.com');

    const response = await request('DELETE', `/${await sportOf(cls.id)}?confirm=true`, manager);
    expect(response.status).toBe(409);
    expect(await readCode(response)).toBe('HAS_DEPENDENCIES');
    expect((await prisma.class.findUniqueOrThrow({ where: { id: cls.id } })).status).toBe('OPEN');
  });
});
