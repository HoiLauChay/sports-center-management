import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import app from '~/app';
import { prisma } from '~/configs/db';
import { env } from '~/configs/env';
import { resetDatabase } from './helpers/db';
import { createAccount } from './helpers/http';
import { expectWalletConsistent } from './helpers/wallet';

const API_KEY = 'test-sepay-webhook-key';

let server: Server;
let baseUrl: string;
let nextSepayId = 1;

beforeAll(async () => {
  env.SEPAY_WEBHOOK_API_KEY = API_KEY;
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(() => server.close());
beforeEach(resetDatabase);

const payload = (overrides: Record<string, unknown> = {}) => ({
  id: nextSepayId++,
  gateway: 'MBBank',
  transactionDate: '2026-10-02 10:15:00',
  accountNumber: '0123456789',
  subAccount: null,
  code: null,
  content: 'chuyen tien',
  transferType: 'in',
  transferAmount: 200_000,
  accumulated: 1_000_000,
  referenceCode: 'FT26275123',
  description: 'BankAPINotify',
  ...overrides,
});

const sendWebhook = (body: unknown, authorization = `Apikey ${API_KEY}`) =>
  fetch(`${baseUrl}/api/v1/payments/sepay/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authorization },
    body: JSON.stringify(body),
  });

const createTopUpInvoice = (accountId: string, overrides: { expiresAt?: Date; status?: 'EXPIRED' } = {}) =>
  prisma.invoice.create({
    data: {
      purpose: 'WALLET_TOP_UP',
      accountId,
      createdById: accountId,
      paymentCode: 'HLCK7M2QX9P',
      amount: 200_000,
      expiresAt: new Date(Date.now() + 15 * 60_000),
      ...overrides,
    },
  });

describe('SePay webhook', () => {
  test('rejects a wrong API key and ignores outgoing transfers', async () => {
    expect((await sendWebhook(payload(), 'Apikey wrong')).status).toBe(401);

    const outgoing = await sendWebhook(payload({ transferType: 'out' }));
    expect(outgoing.status).toBe(200);
    expect(await outgoing.json()).toEqual({ success: true });
    expect(await prisma.bankTransaction.count()).toBe(0);
  });

  test('matching code and amount credits the wallet once, even when the webhook is resent', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const invoice = await createTopUpInvoice(member.id);
    const body = payload({ content: 'MBVCB.123 nap vi hlck7m2qx9p cam on' });

    const responses = await Promise.all([sendWebhook(body), sendWebhook(body), sendWebhook(body)]);
    expect(responses.map(({ status }) => status)).toEqual([200, 200, 200]);

    expect(await prisma.bankTransaction.findMany({ select: { status: true, paymentCode: true } })).toEqual([
      { status: 'MATCHED', paymentCode: 'HLCK7M2QX9P' },
    ]);
    expect(await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).toMatchObject({ status: 'PAID' });
    expect(await expectWalletConsistent(member.id)).toBe(200_000);
    expect(await prisma.notification.count({ where: { accountId: member.id, sendEmail: true } })).toBe(1);
  });

  test('wrong amount stays unmatched and notifies managers without crediting', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const invoice = await createTopUpInvoice(member.id);

    await sendWebhook(payload({ content: 'HLCK7M2QX9P', transferAmount: 210_000 }));

    expect(await prisma.bankTransaction.findFirstOrThrow()).toMatchObject({ status: 'UNMATCHED' });
    expect(await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).toMatchObject({ status: 'PENDING' });
    expect(await expectWalletConsistent(member.id)).toBe(0);
    expect(await prisma.notification.count({ where: { accountId: manager.id } })).toBe(1);
  });

  test('money arriving after the invoice expired is still credited once', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    await createTopUpInvoice(member.id, { status: 'EXPIRED', expiresAt: new Date(Date.now() - 60_000) });

    await sendWebhook(payload({ content: 'HLCK7M2QX9P' }));
    const second = await sendWebhook(payload({ content: 'HLCK7M2QX9P' }));
    expect(second.status).toBe(200);

    expect(
      (await prisma.bankTransaction.findMany({ orderBy: { sepayId: 'asc' } })).map(({ status }) => status),
    ).toEqual(['MATCHED', 'UNMATCHED']);
    expect(await expectWalletConsistent(member.id)).toBe(200_000);
  });
});
