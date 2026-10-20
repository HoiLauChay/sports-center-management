import type { Account, LoginStartResult } from '@sports-center/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { prisma } from '~/configs/db';
import mailService from '~/services/mail.service';
import { hashPassword } from '~/utils/password';
import { resetDatabase } from './helpers/db';
import { createAccount, readCode, readResult, startServer } from './helpers/http';

let server: Server;
let users: Awaited<ReturnType<typeof startServer>>['request'];
let authUrl: string;
let codes: string[];

beforeAll(async () => {
  ({ server, request: users } = await startServer('/users'));
  authUrl = `http://localhost:${(server.address() as AddressInfo).port}/api/v1/auth`;
});

afterAll(() => server.close());

beforeEach(async () => {
  await resetDatabase();
  codes = [];
  spyOn(mailService, 'sendBatch').mockResolvedValue(undefined);
  spyOn(mailService, 'sendOtp').mockImplementation(async (_to, _purpose, code) => {
    codes.push(code);
  });
});

afterEach(() => mock.restore());

const post = (path: string, body: unknown) =>
  fetch(authUrl + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const start = async (email: string) => readResult<LoginStartResult>(await post('/login/start', { email }));

describe('first login', () => {
  test('a staff account created by a manager sets its first password with an emailed code', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const email = 'new.coach@example.com';
    const created = await readResult<Account>(
      await users('POST', '/', manager, { email, fullName: 'Trần Huấn', role: 'COACH' }),
    );
    expect(created.mustSetPassword).toBe(true);
    expect((await post('/login', { email, password: 'Anything1' })).status).toBe(401);

    expect(await start(email)).toEqual({ next: 'SET_PASSWORD', retryAfter: 60 });
    const again = await start(email);
    expect(again.next).toBe('SET_PASSWORD');
    expect(again.retryAfter).toBeLessThanOrEqual(60);
    expect(codes).toHaveLength(1);
    const [code] = codes;

    const wrong = await post('/verify-otp', {
      email,
      purpose: 'ACCOUNT_SETUP',
      otp: code === '000000' ? '111111' : '000000',
    });
    expect([wrong.status, await readCode(wrong)]).toEqual([400, 'OTP_INVALID']);
    expect((await post('/verify-otp', { email, purpose: 'ACCOUNT_SETUP', otp: code })).status).toBe(204);

    const body = { email, otp: code, password: 'NewPassword1', confirmPassword: 'NewPassword1' };
    const set = await post('/set-password', body);
    expect(set.status).toBe(200);
    expect(set.headers.getSetCookie().some((cookie) => cookie.startsWith('access_token='))).toBe(true);
    const account = await readResult<Account>(set);
    expect(account.mustSetPassword).toBe(false);
    expect(account.emailVerifiedAt).not.toBeNull();

    expect((await post('/set-password', body)).status).toBe(400);
    expect(await start(email)).toEqual({ next: 'PASSWORD' });
    expect((await post('/login', { email, password: 'NewPassword1' })).status).toBe(200);
  });

  test('unknown, inactive and ordinary accounts go to the password step without an email', async () => {
    await createAccount('COACH', 'inactive@example.com', { mustSetPassword: true, status: 'INACTIVE' });
    await createAccount('MEMBER', 'member@example.com');

    expect(await start('nobody@example.com')).toEqual({ next: 'PASSWORD' });
    expect(await start('inactive@example.com')).toEqual({ next: 'PASSWORD' });
    expect(await start('member@example.com')).toEqual({ next: 'PASSWORD' });
    expect(codes).toHaveLength(0);
  });

  test('a manager reset logs the user out and sends them through the code step again', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'desk@example.com');
    const member = await createAccount('MEMBER', 'member@example.com', {
      passwordHash: await hashPassword('OldPassword1'),
      emailVerifiedAt: new Date(),
    });
    expect((await post('/login', { email: member.email, password: 'OldPassword1' })).status).toBe(200);

    expect((await users('POST', `/${member.id}/reset-password`, receptionist)).status).toBe(403);
    const self = await users('POST', `/${manager.id}/reset-password`, manager);
    expect([self.status, await readCode(self)]).toEqual([409, 'INVALID_STATE']);

    const reset = await users('POST', `/${member.id}/reset-password`, manager);
    expect(reset.status).toBe(200);
    expect((await readResult<Account>(reset)).mustSetPassword).toBe(true);
    expect(await prisma.refreshToken.count({ where: { accountId: member.id, revokedAt: null } })).toBe(0);
    expect((await post('/login', { email: member.email, password: 'OldPassword1' })).status).toBe(401);
    expect((await start(member.email)).next).toBe('SET_PASSWORD');

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: member.id, action: 'UPDATE' } });
    expect(audit.newValues).toMatchObject({ mustSetPassword: true });
    expect(
      await prisma.notification.count({ where: { accountId: member.id, title: 'Mật khẩu của bạn đã được đặt lại' } }),
    ).toBe(1);
  });
});
