import type { Invoice, Quote } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import app from '~/app';
import { prisma } from '~/configs/db';
import { env } from '~/configs/env';
import { addDays, todayInCenter } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { buildFetcher, createAccount, readCode, readResult } from './helpers/http';
import { expectOrderConsistent } from './helpers/order';
import { seedFacility } from './helpers/schedule';
import { expectWalletConsistent } from './helpers/wallet';

const API_KEY = 'test-sepay-webhook-key';

let server: Server;
let baseUrl: string;
let checkout: ReturnType<typeof buildFetcher>;
let invoices: ReturnType<typeof buildFetcher>;
let nextSepayId = 1;

const day = addDays(todayInCenter(), 2);
const guest = { guest: { name: 'Khách A', phone: '0901234567' } };
const booking = (facilityId: string, startTime = '18:00', endTime = '19:00') => ({
  type: 'FACILITY_BOOKING',
  facilityId,
  date: day,
  startTime,
  endTime,
});

beforeAll(async () => {
  env.SEPAY_WEBHOOK_API_KEY = API_KEY;
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  checkout = buildFetcher(`${baseUrl}/api/v1/checkout`);
  invoices = buildFetcher(`${baseUrl}/api/v1/invoices`);
});

afterAll(() => server.close());

beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
});

const transfer = (paymentCode: string, amount: number, id = nextSepayId++) =>
  fetch(`${baseUrl}/api/v1/payments/sepay/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authorization: `Apikey ${API_KEY}` },
    body: JSON.stringify({
      id,
      referenceCode: `FT2627${id}`,
      gateway: 'MBBank',
      transactionDate: '2026-10-07 10:15:00',
      accountNumber: env.SEPAY_BANK_ACCOUNT ?? '0123456789',
      subAccount: null,
      code: null,
      content: `thanh toan ${paymentCode}`,
      transferType: 'in',
      transferAmount: amount,
      accumulated: 1_000_000,
      description: 'BankAPINotify',
    }),
  });

describe('counter invoice', () => {
  test('a pending invoice holds its slot until it is cancelled; each buyer has at most three', async () => {
    const court = await seedFacility(1);
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    const member = await createAccount('MEMBER', 'member@example.com');
    const issue = (items: unknown[], expectedTotal = 100_000) =>
      checkout('POST', '/invoices', receptionist, { buyer: guest, items, expectedTotal });

    const issued = await issue([booking(court.id)]);
    expect(issued.status).toBe(201);
    const invoice = await readResult<Invoice>(issued);
    expect(invoice).toMatchObject({
      purpose: 'COUNTER_ORDER',
      status: 'PENDING',
      amount: 100_000,
      guestName: 'Khách A',
    });

    const quoteSlot = async () =>
      (await readResult<Quote>(await checkout('POST', '/quote', member, { items: [booking(court.id)] }))).items[0]!;
    expect(await quoteSlot()).toMatchObject({ valid: false, error: { code: 'SCHEDULE_CONFLICT' } });

    expect((await invoices('POST', `/${invoice.id}/cancel`, receptionist)).status).toBe(200);
    expect(await quoteSlot()).toMatchObject({ valid: true });
    expect(await readCode(await invoices('POST', `/${invoice.id}/cancel`, receptionist))).toBe('CONFLICT');

    for (const [start, end] of [
      ['08:00', '09:00'],
      ['09:00', '10:00'],
      ['10:00', '11:00'],
    ]) {
      expect((await issue([booking(court.id, start, end)])).status).toBe(201);
    }
    expect(await readCode(await issue([booking(court.id, '11:00', '12:00')]))).toBe('TOO_MANY_PENDING_INVOICES');
  });

  test('money for a pending invoice creates exactly one order', async () => {
    const court = await seedFacility(1);
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    const member = await createAccount('MEMBER', 'member@example.com');
    const invoice = await readResult<Invoice>(
      await checkout('POST', '/invoices', receptionist, {
        buyer: { accountId: member.id },
        items: [booking(court.id)],
        expectedTotal: 100_000,
      }),
    );

    const first = await transfer(invoice.paymentCode, 100_000, 9001);
    const resent = await transfer(invoice.paymentCode, 100_000, 9001);
    const second = await transfer(invoice.paymentCode, 100_000);
    expect([first.status, resent.status, second.status]).toEqual([200, 200, 200]);

    const order = await prisma.order.findFirstOrThrow({ include: { items: true } });
    expect(await prisma.order.count()).toBe(1);
    expect(order).toMatchObject({ paymentMethod: 'TRANSFER', accountId: member.id, createdById: receptionist.id });
    await expectOrderConsistent(order.id);
    expect(await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).toMatchObject({
      status: 'PAID',
      orderId: order.id,
    });
    expect(await prisma.facilityBooking.count({ where: { orderItemId: order.items[0]!.id } })).toBe(1);
    expect(
      (await prisma.bankTransaction.findMany({ orderBy: { createdAt: 'asc' } })).map(({ status }) => status),
    ).toEqual(['MATCHED', 'UNMATCHED']);
  });

  test('money after expiry or for a service no longer sold goes to the member wallet or stays unmatched', async () => {
    const court = await seedFacility(1);
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    const member = await createAccount('MEMBER', 'member@example.com');
    const issue = async (buyer: unknown, startTime: string, endTime: string) =>
      readResult<Invoice>(
        await checkout('POST', '/invoices', receptionist, {
          buyer,
          items: [booking(court.id, startTime, endTime)],
          expectedTotal: 100_000,
        }),
      );
    const late = await issue({ accountId: member.id }, '08:00', '09:00');
    const closed = await issue(guest, '09:00', '10:00');
    await prisma.invoice.update({ where: { id: late.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await prisma.facility.update({ where: { id: court.id }, data: { isActive: false } });

    await transfer(late.paymentCode, 100_000);
    await transfer(closed.paymentCode, 100_000);

    expect(await prisma.order.count()).toBe(0);
    const statuses = await prisma.invoice.findMany({ select: { id: true, status: true } });
    expect(statuses.every(({ status }) => status === 'FAILED')).toBe(true);
    expect(await expectWalletConsistent(member.id)).toBe(100_000);
    const bank = await prisma.bankTransaction.findMany({ orderBy: { createdAt: 'asc' } });
    expect(bank.map(({ status }) => status)).toEqual(['MATCHED', 'UNMATCHED']);
    expect(bank[1]!.note).toContain(closed.paymentCode);
    expect(await prisma.notification.count({ where: { accountId: receptionist.id } })).toBe(2);
  });
});
