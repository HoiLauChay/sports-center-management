import type { MemberMembership, MyMemberships, Quote, StaffMembershipResult } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { addDays, todayInCenter } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { buildFetcher, createAccount, readCode, readResult, startServer } from './helpers/http';
import { giveActiveMembership } from './helpers/membership';
import { seedFacility } from './helpers/schedule';
import { expectWalletConsistent, seedBalance } from './helpers/wallet';

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

describe('staff membership support', () => {
  test('staff subscribe or switch a member from the wallet, and a short wallet changes nothing', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'desk@example.com');
    const manager = await createAccount('MANAGER', 'boss@example.com');
    const coach = await createAccount('COACH', 'coach@example.com');
    await seedBalance(member.id, 400_000);
    await giveActiveMembership(member.id);
    const gold = await prisma.memberMembership.findFirstOrThrow({ where: { accountId: member.id } });
    const silver = await prisma.membership.create({ data: { name: 'Silver', price: 300_000, durationDays: 30 } });
    const platinum = await prisma.membership.create({ data: { name: 'Platinum', price: 600_000, durationDays: 30 } });
    const body = { packageId: silver.id, expectedTotal: 300_000, idempotencyKey: 'desk-switch-1' };

    expect((await users('POST', `/${member.id}/memberships`, coach, body)).status).toBe(403);
    expect((await users('POST', `/${member.id}/memberships`, member, body)).status).toBe(403);

    const switched = await users('POST', `/${member.id}/memberships`, receptionist, body);
    expect(switched.status).toBe(201);
    const result = await readResult<StaffMembershipResult>(switched);
    expect(result.order).toMatchObject({ paymentMethod: 'WALLET', totalAmount: 300_000 });
    expect(result.order.createdBy?.id).toBe(receptionist.id);
    expect(result.membership).toMatchObject({ package: { id: silver.id }, status: 'ACTIVE', autoRenew: true });
    expect(await prisma.memberMembership.findUniqueOrThrow({ where: { id: gold.id } })).toMatchObject({
      status: 'CANCELLED',
      autoRenew: false,
    });

    expect((await users('POST', `/${member.id}/memberships`, receptionist, body)).status).toBe(201);
    expect(await expectWalletConsistent(member.id)).toBe(100_000);

    const same = await users('POST', `/${member.id}/memberships`, manager, { ...body, idempotencyKey: 'boss-same-1' });
    expect([same.status, await readCode(same)]).toEqual([409, 'INVALID_STATE']);

    const short = await users('POST', `/${member.id}/memberships`, manager, {
      packageId: platinum.id,
      expectedTotal: 600_000,
      idempotencyKey: 'boss-switch-1',
    });
    expect([short.status, await readCode(short)]).toEqual([409, 'INSUFFICIENT_BALANCE']);
    const active = await prisma.memberMembership.findMany({ where: { accountId: member.id, status: 'ACTIVE' } });
    expect(active.map(({ packageId }) => packageId)).toEqual([silver.id]);
    expect(await expectWalletConsistent(member.id)).toBe(100_000);
    expect(await prisma.order.count({ where: { accountId: member.id } })).toBe(2);
  });

  test('terminating ends the membership today with a reason, refunds nothing and tells the member', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const manager = await createAccount('MANAGER', 'boss@example.com');
    const active = await seedMembership(member.id);
    const path = `/${member.id}/memberships/${active.id}/terminate`;

    expect((await users('POST', path, manager, { reason: '  ' })).status).toBe(422);

    const terminated = await users('POST', path, manager, { reason: 'Vi phạm nội quy' });
    expect(terminated.status).toBe(200);
    const membership = await readResult<MemberMembership>(terminated);
    expect(membership).toMatchObject({ status: 'CANCELLED', endDate: todayInCenter(), autoRenew: false });
    expect(membership.currentBenefits).toBeNull();

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: active.id } });
    expect(audit.newValues).toMatchObject({ status: 'CANCELLED', reason: 'Vi phạm nội quy' });
    expect(
      await prisma.notification.count({ where: { accountId: member.id, title: 'Gói thành viên đã chấm dứt' } }),
    ).toBe(1);
    expect(await prisma.walletTransaction.count({ where: { accountId: member.id } })).toBe(0);

    const again = await users('POST', path, manager, { reason: 'Vi phạm nội quy' });
    expect([again.status, await readCode(again)]).toEqual([409, 'INVALID_STATE']);
  });
});
