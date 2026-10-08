import type { MemberMembership, MyMemberships, Quote } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { addDays, todayInCenter } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { buildFetcher, createAccount, readCode, readResult, startServer } from './helpers/http';
import { giveActiveMembership } from './helpers/membership';
import { seedFacility } from './helpers/schedule';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];
let users: ReturnType<typeof buildFetcher>;
let checkout: ReturnType<typeof buildFetcher>;

beforeAll(async () => {
  ({ server, request } = await startServer('/me/memberships'));
  const base = `http://localhost:${(server.address() as { port: number }).port}/api/v1`;
  users = buildFetcher(`${base}/users`);
  checkout = buildFetcher(`${base}/checkout`);
});

afterAll(() => server.close());

beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
});

const seedMembership = async (accountId: string) => {
  await giveActiveMembership(accountId, { bookingDiscountPct: 20 });
  const active = await prisma.memberMembership.findFirstOrThrow({ where: { accountId } });
  await prisma.memberMembership.create({
    data: {
      accountId,
      packageId: active.packageId,
      startDate: new Date(addDays(todayInCenter(), -90)),
      endDate: new Date(addDays(todayInCenter(), -60)),
      status: 'EXPIRED',
    },
  });
  return active;
};

describe('member memberships', () => {
  test('a cancelled membership keeps its benefits until it ends and is not renewed', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    const court = await seedFacility(1);
    const active = await seedMembership(member.id);
    await prisma.memberMembership.update({ where: { id: active.id }, data: { autoRenew: true } });
    const quoteBooking = async () =>
      (
        await readResult<Quote>(
          await checkout('POST', '/quote', member, {
            items: [
              {
                type: 'FACILITY_BOOKING',
                facilityId: court.id,
                date: addDays(todayInCenter(), 1),
                startTime: '08:00',
                endTime: '09:00',
              },
            ],
          }),
        )
      ).total;

    const before = await readResult<MyMemberships>(await request('GET', '/', member));
    expect(before.current).toMatchObject({
      id: active.id,
      cancelledAt: null,
      currentBenefits: { bookingDiscountPct: 20 },
    });
    expect(before.history.map(({ status }) => status)).toEqual(['EXPIRED']);

    const cancelled = await readResult<MemberMembership>(
      await users('POST', `/${member.id}/memberships/${active.id}/cancel`, receptionist),
    );
    expect(cancelled).toMatchObject({
      status: 'ACTIVE',
      autoRenew: false,
      currentBenefits: { bookingDiscountPct: 20 },
    });
    expect(cancelled.cancelledAt).not.toBeNull();

    const after = await readResult<MyMemberships>(await request('GET', '/', member));
    expect(after.current?.id).toBe(active.id);
    expect(await quoteBooking()).toBe(80_000);
    expect(await readCode(await request('POST', `/${active.id}/cancel`, member))).toBe('INVALID_STATE');
    expect(await prisma.auditLog.count({ where: { entityType: 'MEMBER_MEMBERSHIP', entityId: active.id } })).toBe(1);
  });

  test("a member cannot cancel someone else's membership", async () => {
    const owner = await createAccount('MEMBER', 'owner@example.com');
    const other = await createAccount('MEMBER', 'other@example.com');
    const active = await seedMembership(owner.id);

    expect((await request('POST', `/${active.id}/cancel`, other)).status).toBe(404);
    expect(await prisma.memberMembership.findUniqueOrThrow({ where: { id: active.id } })).toMatchObject({
      status: 'ACTIVE',
      cancelledAt: null,
    });
  });
});
