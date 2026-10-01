import type { Invoice, Paginated } from '@sports-center/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { paymentCode } from '~/utils/paymentCode';
import { resetDatabase } from './helpers/db';
import { createAccount, readCode, readResult, startServer, type Viewer } from './helpers/http';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];

beforeAll(async () => {
  ({ server, request } = await startServer(''));
});

afterAll(() => server.close());
beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
});
afterEach(() => mock.restore());

const createTopUp = (viewer: Viewer, body: unknown) => request('POST', '/wallet/top-ups', viewer, body);

const readErrorPaths = async (response: Response) =>
  ((await response.json()) as { errors?: { path: string }[] }).errors?.map(({ path }) => path);

describe('wallet top-up invoices', () => {
  test('member creates a top-up invoice with a payment code and default 15-minute expiry', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');

    const tooSmall = await createTopUp(member, { amount: 5_000 });
    expect(tooSmall.status).toBe(422);
    expect(await readErrorPaths(tooSmall)).toEqual(['body.amount']);

    const before = Date.now();
    const response = await createTopUp(member, { amount: 200_000 });
    expect(response.status).toBe(201);
    const invoice = await readResult<Invoice>(response);
    expect(invoice).toMatchObject({
      purpose: 'WALLET_TOP_UP',
      status: 'PENDING',
      amount: 200_000,
      account: { id: member.id },
      createdBy: { id: member.id },
    });
    expect(invoice.paymentCode).toMatch(/^HLC[A-HJ-NP-Z2-9]{8}$/);
    expect(invoice.transferContent).toBe(invoice.paymentCode);
    expect(invoice.qrImageUrl).toContain(`des=${invoice.paymentCode}`);
    const expiresIn = new Date(invoice.expiresAt).getTime() - before;
    expect(expiresIn).toBeGreaterThanOrEqual(15 * 60_000);
    expect(expiresIn).toBeLessThan(16 * 60_000);
  });

  test('a colliding payment code is regenerated', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const first = await readResult<Invoice>(await createTopUp(member, { amount: 100_000 }));

    const generate = paymentCode.generate;
    spyOn(paymentCode, 'generate')
      .mockImplementationOnce(() => first.paymentCode)
      .mockImplementation(generate);

    const second = await createTopUp(member, { amount: 100_000 });
    expect(second.status).toBe(201);
    expect((await readResult<Invoice>(second)).paymentCode).not.toBe(first.paymentCode);
  });

  test('concurrent requests never leave more than 3 pending top-up invoices; expired ones do not count', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    await prisma.invoice.create({
      data: {
        purpose: 'WALLET_TOP_UP',
        accountId: member.id,
        createdById: member.id,
        paymentCode: 'HLCOLDOLD22',
        amount: 100_000,
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const responses = await Promise.all(Array.from({ length: 4 }, () => createTopUp(member, { amount: 100_000 })));
    expect(responses.map(({ status }) => status).sort()).toEqual([201, 201, 201, 409]);
    expect(await readCode(responses.find(({ status }) => status === 409)!)).toBe('TOO_MANY_PENDING_TOP_UPS');
    expect(await prisma.invoice.count({ where: { accountId: member.id, status: 'PENDING' } })).toBe(4);
  });

  test('receptionist creates a top-up invoice for a member only', async () => {
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    const member = await createAccount('MEMBER', 'member@example.com');
    const coach = await createAccount('COACH', 'coach@example.com');

    const missing = await createTopUp(receptionist, { amount: 100_000 });
    expect(await readErrorPaths(missing)).toEqual(['body.accountId']);
    const notMember = await createTopUp(receptionist, { accountId: coach.id, amount: 100_000 });
    expect(await readErrorPaths(notMember)).toEqual(['body.accountId']);

    const response = await createTopUp(receptionist, { accountId: member.id, amount: 100_000 });
    expect(await readResult<Invoice>(response)).toMatchObject({
      account: { id: member.id },
      createdBy: { id: receptionist.id },
    });
    expect((await createTopUp(coach, { amount: 100_000 })).status).toBe(403);
  });

  test('members only see their own invoices while staff see any', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const other = await createAccount('MEMBER', 'other@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    const invoice = await readResult<Invoice>(await createTopUp(other, { amount: 100_000 }));
    await createTopUp(member, { amount: 100_000 });

    expect((await request('GET', `/invoices/${invoice.id}`, member)).status).toBe(404);
    expect((await request('GET', `/invoices/${invoice.id}`, other)).status).toBe(200);
    expect((await request('GET', `/invoices/${invoice.id}`, receptionist)).status).toBe(200);

    const page = await readResult<Paginated<Invoice>>(await request('GET', '/me/invoices', member));
    expect(page.total).toBe(1);
    expect(page.items[0]?.account?.id).toBe(member.id);
  });
});
