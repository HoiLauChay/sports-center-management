import type { BankTransaction, Reconciliation, SepaySyncResult } from '@sports-center/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { env } from '~/configs/env';
import bankTransactionService from '~/services/bankTransaction.service';
import type { SepayTransaction } from '~/utils/sepayApi';
import { resetDatabase } from './helpers/db';
import { createAccount, readCode, readResult, startServer } from './helpers/http';
import { expectWalletConsistent } from './helpers/wallet';

const SEPAY_BASE = 'https://userapi-sandbox.sepay.test';
const ACCOUNT = '0000000001';
const CRON_SECRET = 'test-cron-secret-at-least-32-characters';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];
let baseUrl: string;
const originalFetch = globalThis.fetch;
let sepayPages: SepayTransaction[][] = [];
let sepayStatus = 200;

const row = (overrides: Partial<SepayTransaction>): SepayTransaction => ({
  id: crypto.randomUUID(),
  transaction_date: '2026-10-02 16:20:48',
  account_number: ACCOUNT,
  transfer_type: 'in',
  amount_in: 200_000,
  transaction_content: 'chuyen tien',
  reference_number: null,
  bank_brand_name: 'MBBank',
  webhook_success: 1,
  ...overrides,
});

beforeAll(async () => {
  Object.assign(env, {
    SEPAY_API_BASE_URL: SEPAY_BASE,
    SEPAY_API_TOKEN: 'test-token',
    SEPAY_BANK_ACCOUNT: ACCOUNT,
    CRON_SECRET,
  });
  ({ server, request } = await startServer('/bank-transactions'));
  baseUrl = `http://localhost:${(server.address() as { port: number }).port}/api/v1`;
  spyOn(globalThis, 'fetch').mockImplementation((async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.origin !== SEPAY_BASE) return originalFetch(input, init);
    if (sepayStatus !== 200) return new Response('error', { status: sepayStatus });
    const page = Number(url.searchParams.get('page'));
    return Response.json({
      status: 'success',
      data: sepayPages[page - 1] ?? [],
      meta: { pagination: { has_more: page < sepayPages.length } },
    });
  }) as typeof fetch);
});

afterAll(() => {
  mock.restore();
  Object.assign(env, {
    SEPAY_API_BASE_URL: undefined,
    SEPAY_API_TOKEN: undefined,
    SEPAY_BANK_ACCOUNT: undefined,
  });
  server.close();
});

beforeEach(async () => {
  await resetDatabase();
  sepayPages = [];
  sepayStatus = 200;
});

afterEach(() => {
  sepayStatus = 200;
});

const sync = async () => {
  const response = await originalFetch(`${baseUrl}/cron/sepay-sync`, {
    method: 'POST',
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  expect(response.status).toBe(200);
  return readResult<SepaySyncResult>(response);
};

const unmatched = (referenceCode: string) =>
  prisma.bankTransaction.create({
    data: {
      sepayId: null,
      bankName: 'MBBank',
      accountNumber: ACCOUNT,
      amount: 200_000,
      content: 'chuyen nham',
      referenceCode,
      transactionDate: new Date('2026-10-02T09:00:00Z'),
      status: 'UNMATCHED',
      rawPayload: {},
    },
  });

describe('bank transactions', () => {
  test('a manager resolves an unmatched transfer once; handling it again is rejected', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const member = await createAccount('MEMBER', 'member@example.com');
    const first = await unmatched('REF-1');
    const second = await unmatched('REF-2');

    const resolved = await request('POST', `/${first.id}/resolve`, manager, {
      accountId: member.id,
      note: 'Quên ghi mã',
    });
    expect(resolved.status).toBe(200);
    expect(await readResult<BankTransaction>(resolved)).toMatchObject({
      status: 'RESOLVED',
      resolvedAccount: { id: member.id },
      handledBy: { id: manager.id },
      note: 'Quên ghi mã',
    });

    const again = await request('POST', `/${first.id}/resolve`, manager, { accountId: member.id, note: 'Lần hai' });
    expect(again.status).toBe(409);
    expect(await readCode(again)).toBe('BANK_TRANSACTION_HANDLED');
    expect(await readCode(await request('POST', `/${first.id}/ignore`, manager, { note: 'x' }))).toBe(
      'BANK_TRANSACTION_HANDLED',
    );
    expect(await expectWalletConsistent(member.id)).toBe(200_000);

    expect(await readCode(await request('POST', `/${second.id}/ignore`, manager, {}))).toBe('VALIDATION_ERROR');
    const ignored = await request('POST', `/${second.id}/ignore`, manager, { note: 'Tiền không thuộc hệ thống' });
    expect((await readResult<BankTransaction>(ignored)).status).toBe('IGNORED');

    expect(await prisma.auditLog.count({ where: { entityType: 'BANK_TRANSACTION' } })).toBe(2);
    const list = await readResult<{ items: BankTransaction[] }>(await request('GET', '?status=RESOLVED', manager));
    expect(list.items.map(({ id }) => id)).toEqual([first.id]);
  });

  test('sync adds transfers the webhook missed, matches them like the webhook and never credits twice', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    await prisma.invoice.create({
      data: {
        purpose: 'WALLET_TOP_UP',
        accountId: member.id,
        createdById: member.id,
        paymentCode: 'HLCSYNC0001',
        amount: 200_000,
        expiresAt: new Date(Date.now() + 15 * 60_000),
      },
    });
    await bankTransactionService.ingest({
      sepayId: 35540n,
      bankName: 'MBBank',
      accountNumber: ACCOUNT,
      amount: 50_000,
      content: 'nap tien',
      referenceCode: 'REF-WEBHOOK',
      transactionDate: new Date('2026-10-02T09:10:15Z'),
      rawPayload: {},
    });

    sepayPages = [
      [
        row({ reference_number: 'REF-WEBHOOK', amount_in: 50_000, transaction_content: 'nap tien' }),
        row({ reference_number: 'REF-MISSED', transaction_content: 'MBVCB nap vi hlcsync0001', webhook_success: 0 }),
      ],
      [row({ account_number: '9999999999', reference_number: 'REF-OTHER' }), row({ reference_number: null })],
    ];

    expect(await sync()).toEqual({
      skipped: false,
      partial: false,
      fetched: 3,
      inserted: 2,
      matched: 1,
      unmatched: 1,
      duplicates: 1,
      missedWebhooks: 1,
    });
    expect(await sync()).toMatchObject({ fetched: 3, inserted: 0, duplicates: 3 });

    expect(await prisma.bankTransaction.count()).toBe(3);
    expect(await prisma.bankTransaction.findFirstOrThrow({ where: { referenceCode: 'REF-MISSED' } })).toMatchObject({
      sepayId: null,
      status: 'MATCHED',
      paymentCode: 'HLCSYNC0001',
    });
    expect(await prisma.invoice.findFirstOrThrow()).toMatchObject({ status: 'PAID' });
    expect(await expectWalletConsistent(member.id)).toBe(200_000);
  });

  test('reconciliation compares SePay and the system per day and reports missing references', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    await unmatched('REF-1');
    sepayPages = [
      [
        row({ reference_number: 'REF-1', transaction_date: '2026-10-02 16:00:00' }),
        row({ reference_number: 'REF-LATE', transaction_date: '2026-10-03 08:00:00', amount_in: 50_000 }),
      ],
    ];

    const result = await readResult<Reconciliation>(
      await request('GET', '/reconciliation?from=2026-10-02&to=2026-10-03', manager),
    );
    expect(result.days).toEqual([
      {
        date: '2026-10-02',
        sepay: { count: 1, amount: 200_000 },
        system: { count: 1, amount: 200_000 },
        matched: true,
        missingReferenceCodes: [],
      },
      {
        date: '2026-10-03',
        sepay: { count: 1, amount: 50_000 },
        system: { count: 0, amount: 0 },
        matched: false,
        missingReferenceCodes: ['REF-LATE'],
      },
    ]);

    sepayStatus = 500;
    const down = await request('GET', '/reconciliation?from=2026-10-02&to=2026-10-03', manager);
    expect(down.status).toBe(503);
    expect(await readCode(down)).toBe('UPSTREAM_UNAVAILABLE');
  });
});
