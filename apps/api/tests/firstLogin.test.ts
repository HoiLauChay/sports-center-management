import type { Account, ActivationInfo, LoginStartResult } from '@sports-center/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { prisma } from '~/configs/db';
import { env } from '~/configs/env';
import mailService from '~/services/mail.service';
import { hashPassword } from '~/utils/password';
import { resetDatabase } from './helpers/db';
import { buildFetcher, createAccount, readCode, readResult, startServer } from './helpers/http';

let server: Server;
let users: Awaited<ReturnType<typeof startServer>>['request'];
let authUrl: string;
let codes: string[];
let links: { to: string; url: string; reason: string }[];

beforeAll(async () => {
  ({ server, request: users } = await startServer('/users'));
  authUrl = `http://localhost:${(server.address() as AddressInfo).port}/api/v1/auth`;
});

afterAll(() => server.close());

beforeEach(async () => {
  await resetDatabase();
  codes = [];
  links = [];
  spyOn(mailService, 'sendBatch').mockResolvedValue(undefined);
  spyOn(mailService, 'sendActivation').mockImplementation(async (to, _fullName, url, reason) => {
    links.push({ to, url, reason });
  });
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

const tokenAt = (index: number) => new URL(links[index]?.url ?? 'http://invalid').searchParams.get('token') ?? '';

const activate = (token: string, password = 'NewPassword1') =>
  post('/activate', { token, password, confirmPassword: password });

const expectInvalid = async (res: Response, code = 'TOKEN_INVALID') => {
  expect([res.status, await readCode(res)]).toEqual([400, code]);
};

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

  test('the welcome email link sets the first password and logs in once', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const email = 'linked.coach@example.com';
    await users('POST', '/', manager, { email, fullName: 'Lê Liên Kết', role: 'COACH' });
    expect(links).toEqual([
      { to: email, url: expect.stringMatching(/^http:\/\/localhost:5173\/activate\?token=/), reason: 'CREATED' },
    ]);
    const token = tokenAt(0);

    const [id, secret] = token.split('.');
    await expectInvalid(await post('/activation', { token: 'garbage' }));
    await expectInvalid(await post('/activation', { token: `${id}.${secret}x` }));
    for (let i = 0; i < 2; i += 1) {
      const check = await post('/activation', { token });
      expect(await readResult<ActivationInfo>(check)).toEqual({ email, fullName: 'Lê Liên Kết' });
    }

    const mismatch = await post('/activate', { token, password: 'NewPassword1', confirmPassword: 'Other1234' });
    expect(mismatch.status).toBe(422);

    const done = await activate(token);
    expect(done.status).toBe(200);
    expect(done.headers.getSetCookie().some((cookie) => cookie.startsWith('access_token='))).toBe(true);
    const account = await readResult<Account>(done);
    expect(account.mustSetPassword).toBe(false);
    expect(account.emailVerifiedAt).not.toBeNull();

    await expectInvalid(await activate(token, 'Another123'));
    await expectInvalid(await post('/activation', { token }));
    expect(await start(email)).toEqual({ next: 'PASSWORD' });
    expect((await post('/login', { email, password: 'NewPassword1' })).status).toBe(200);
  });

  test('an expired link or one for an account that already set a password does not work', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    await users('POST', '/', manager, { email: 'late@example.com', fullName: 'Trễ Hạn', role: 'COACH' });
    await users('POST', '/', manager, { email: 'otp@example.com', fullName: 'Dùng Mã', role: 'RECEPTIONIST' });
    const [late, viaOtp] = [tokenAt(0), tokenAt(1)];

    await prisma.otpCode.updateMany({
      where: { email: 'late@example.com', purpose: 'ACCOUNT_ACTIVATION' },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expectInvalid(await post('/activation', { token: late }), 'TOKEN_EXPIRED');
    await expectInvalid(await activate(late), 'TOKEN_EXPIRED');

    await start('otp@example.com');
    const [code] = codes;
    const body = { email: 'otp@example.com', otp: code, password: 'NewPassword1', confirmPassword: 'NewPassword1' };
    expect((await post('/set-password', body)).status).toBe(200);
    await expectInvalid(await activate(viaOtp));
  });

  test('unknown, inactive and ordinary accounts go to the password step without an email', async () => {
    await createAccount('COACH', 'inactive@example.com', { passwordHash: null, status: 'INACTIVE' });
    await createAccount('MEMBER', 'member@example.com');

    expect(await start('nobody@example.com')).toEqual({ next: 'PASSWORD' });
    expect(await start('inactive@example.com')).toEqual({ next: 'PASSWORD' });
    expect(await start('member@example.com')).toEqual({ next: 'PASSWORD' });
    expect(codes).toHaveLength(0);
  });

  test('a manager moves a lost account to a new email, logging the user out and sending the code there', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'desk@example.com');
    await createAccount('COACH', 'taken@example.com');
    const member = await createAccount('MEMBER', 'lost@example.com', {
      passwordHash: await hashPassword('OldPassword1'),
      emailVerifiedAt: new Date(),
    });
    expect((await post('/login', { email: member.email, password: 'OldPassword1' })).status).toBe(200);

    const change = (email: string, viewer = manager, id = member.id) =>
      users('PATCH', `/${id}/email`, viewer, { email });
    expect((await change('new@example.com', receptionist)).status).toBe(403);
    const self = await change('boss@example.com', manager, manager.id);
    expect([self.status, await readCode(self)]).toEqual([409, 'INVALID_STATE']);
    const taken = await change('taken@example.com');
    expect([taken.status, await readCode(taken)]).toEqual([409, 'EMAIL_TAKEN']);
    const same = await change('lost@example.com');
    expect([same.status, await readCode(same)]).toEqual([409, 'INVALID_STATE']);

    const changed = await change('  New@Example.com ');
    expect(changed.status).toBe(200);
    expect(await readResult<Account>(changed)).toMatchObject({
      email: 'new@example.com',
      mustSetPassword: true,
      emailVerifiedAt: null,
    });
    expect(await prisma.refreshToken.count({ where: { accountId: member.id, revokedAt: null } })).toBe(0);
    expect((await post('/login', { email: 'new@example.com', password: 'OldPassword1' })).status).toBe(401);
    expect(await start('lost@example.com')).toEqual({ next: 'PASSWORD' });
    expect((await start('new@example.com')).next).toBe('SET_PASSWORD');
    expect(codes).toHaveLength(1);
    expect(links.map(({ to, reason }) => [to, reason])).toEqual([['new@example.com', 'EMAIL_CHANGED']]);
    expect((await activate(tokenAt(0))).status).toBe(200);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: member.id, action: 'UPDATE' } });
    expect(audit.oldValues).toMatchObject({ email: 'lost@example.com' });
    expect(audit.newValues).toMatchObject({ email: 'new@example.com', mustSetPassword: true });
    expect(
      await prisma.notification.count({ where: { accountId: member.id, title: 'Email tài khoản đã được cập nhật' } }),
    ).toBe(1);
  });
});

describe('first Google sign-in', () => {
  const realFetch = globalThis.fetch;

  const fakeGoogle = (userinfo: () => Response) =>
    spyOn(globalThis, 'fetch').mockImplementation((async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.startsWith('https://oauth2.googleapis.com/token')) return Response.json({ access_token: 'google-token' });
      if (url.startsWith('https://www.googleapis.com/oauth2/v3/userinfo')) return userinfo();
      return realFetch(input, init);
    }) as typeof fetch);

  const begin = async (query = '') => {
    const res = await fetch(`${authUrl}/google${query}`, { redirect: 'manual' });
    const stateCookie = res.headers.getSetCookie().find((cookie) => cookie.startsWith('oauth_state=')) ?? '';
    return decodeURIComponent(/^oauth_state=([^;]*)/.exec(stateCookie)?.[1] ?? '');
  };

  const callback = (query: string, cookieState?: string) =>
    fetch(`${authUrl}/google/callback?${query}`, {
      redirect: 'manual',
      headers: cookieState ? { Cookie: `oauth_state=${cookieState}` } : {},
    });

  const signInWithGoogle = async (email: string) => {
    fakeGoogle(() => Response.json({ email, email_verified: true, name: 'Người Dùng Google' }));
    const state = await begin();
    const done = await callback(`code=abc&state=${state}`, state);
    expect(done.headers.get('location')).toBe('http://localhost:5173/dashboard');
    return prisma.account.findUniqueOrThrow({ where: { email } });
  };

  beforeAll(() => {
    env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
    env.GOOGLE_CLIENT_SECRET = 'test-secret';
  });

  test('a new account has no password until it sets one, then signs in with it like any other', async () => {
    const created = await signInWithGoogle('first.google@example.com');
    expect([created.role, created.passwordHash]).toEqual(['MEMBER', null]);

    const me = buildFetcher(authUrl);
    const mismatch = await me('POST', '/first-password', created, {
      password: 'NewPassword1',
      confirmPassword: 'Other1234',
    });
    expect(mismatch.status).toBe(422);

    const body = { password: 'NewPassword1', confirmPassword: 'NewPassword1' };
    const set = await me('POST', '/first-password', created, body);
    expect(set.status).toBe(200);
    expect(set.headers.getSetCookie().some((cookie) => cookie.startsWith('access_token='))).toBe(true);
    expect((await readResult<Account>(set)).mustSetPassword).toBe(false);

    const again = await me('POST', '/first-password', created, body);
    expect([again.status, await readCode(again)]).toEqual([409, 'INVALID_STATE']);
    expect((await post('/login', { email: created.email, password: 'NewPassword1' })).status).toBe(200);
  });

  test('an email that already has an account just signs in, keeping its password and role', async () => {
    const coach = await createAccount('COACH', 'coach.google@example.com', {
      passwordHash: await hashPassword('OldPassword1'),
      emailVerifiedAt: new Date(),
    });

    const signedIn = await signInWithGoogle(coach.email);
    expect([signedIn.id, signedIn.role, signedIn.passwordHash]).toEqual([coach.id, 'COACH', coach.passwordHash]);
    expect((await post('/login', { email: coach.email, password: 'OldPassword1' })).status).toBe(200);

    const blocked = await buildFetcher(authUrl)('POST', '/first-password', coach, {
      password: 'NewPassword1',
      confirmPassword: 'NewPassword1',
    });
    expect([blocked.status, await readCode(blocked)]).toEqual([409, 'INVALID_STATE']);
  });

  test('an account the manager created is verified and gets the Google picture, but still needs a password', async () => {
    const coach = await createAccount('COACH', 'staff.google@example.com', { passwordHash: null });
    fakeGoogle(() =>
      Response.json({ email: coach.email, email_verified: true, picture: 'https://lh3.googleusercontent.com/a/x' }),
    );
    const state = await begin();
    await callback(`code=abc&state=${state}`, state);

    const signedIn = await prisma.account.findUniqueOrThrow({ where: { id: coach.id } });
    expect(signedIn.emailVerifiedAt).not.toBeNull();
    expect([signedIn.avatarUrl, signedIn.passwordHash]).toEqual(['https://lh3.googleusercontent.com/a/x', null]);
  });

  test('failures come back to /login as fixed codes, never as raw error text', async () => {
    const loginError = async (res: Response) => new URL(res.headers.get('location') ?? '').searchParams.get('error');

    expect(await loginError(await callback('error=access_denied'))).toBe('CANCELLED');
    expect(await loginError(await callback('error=server_error'))).toBe('FAILED');

    const state = await begin('?redirect=//evil.example');
    expect(JSON.parse(Buffer.from(state, 'base64url').toString('utf8')).redirect).toBe('/dashboard');
    expect(await loginError(await callback(`code=abc&state=${state}`))).toBe('STATE_MISMATCH');
    expect(await loginError(await callback(`code=abc&state=${state}`, 'other'))).toBe('STATE_MISMATCH');

    await createAccount('MEMBER', 'off@example.com', { status: 'INACTIVE' });
    fakeGoogle(() => Response.json({ email: 'off@example.com', email_verified: true }));
    expect(await loginError(await callback(`code=abc&state=${state}`, state))).toBe('ACCOUNT_INACTIVE');

    fakeGoogle(() => Response.json({ email: 'unverified@example.com', email_verified: false }));
    expect(await loginError(await callback(`code=abc&state=${state}`, state))).toBe('EMAIL_UNVERIFIED');

    spyOn(console, 'error').mockImplementation(() => undefined);
    fakeGoogle(() => {
      throw new Error('Invalid `prisma.account.findUnique()` invocation');
    });
    const crashed = await callback(`code=abc&state=${state}`, state);
    expect(await loginError(crashed)).toBe('FAILED');
    expect(crashed.headers.get('location')).not.toContain('prisma');
  });
});
