import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import authService from '~/services/auth.service';
import mailService from '~/services/mail.service';
import { resetDatabase } from './helpers/db';
import type { buildFetcher } from './helpers/http';
import { createAccount, readCode, readResult, startServer, type Viewer } from './helpers/http';

let server: Server;
let request: ReturnType<typeof buildFetcher>;

beforeAll(async () => {
  ({ server, request } = await startServer('/users'));
});

afterAll(() => server.close());
beforeEach(resetDatabase);
afterEach(() => mock.restore());

const createMember = (email: string) =>
  createAccount('MEMBER', email, {
    fullName: 'Nguyễn Minh',
    phone: '0912345678',
    memberProfile: { create: { healthNotes: 'Ghi chú riêng' } },
  });

const getAs = (path: string, viewer: Viewer) => request('GET', path, viewer);
const postAs = (path: string, viewer: Viewer, body: unknown) => request('POST', path, viewer, body);

interface ListResult {
  items: { id: string; passwordHash?: string }[];
  total: number;
  page: number;
  limit: number;
}

describe('user list and detail permissions', () => {
  test('manager searches and filters roles while receptionist only sees members in items and total', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    const member = await createMember('member@example.com');
    const coach = await createAccount('COACH', 'coach@example.com');

    const managerResponse = await getAs('/?q=COACH&role=COACH', manager);
    expect(managerResponse.status).toBe(200);
    const managerPage = await readResult<ListResult>(managerResponse);
    expect(managerPage.total).toBe(1);
    expect(managerPage.items[0]?.id).toBe(coach.id);
    expect(managerPage.items[0]).not.toHaveProperty('passwordHash');

    const receptionistResponse = await getAs('/?page=1&limit=1', receptionist);
    const receptionistPage = await readResult<ListResult>(receptionistResponse);
    expect(receptionistPage).toMatchObject({ total: 1, page: 1, limit: 1 });
    expect(receptionistPage.items.map((item: { id: string }) => item.id)).toEqual([member.id]);

    const filtered = await getAs('/?role=COACH', receptionist);
    expect(await readResult<ListResult>(filtered)).toMatchObject({ total: 0, items: [] });

    const search = await getAs('/?q=0912345678', receptionist);
    expect((await readResult<ListResult>(search)).items[0]?.id).toBe(member.id);
  });

  test('receptionist cannot fetch staff by ID and coach cannot call either route', async () => {
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const coach = await createAccount('COACH', 'coach@example.com');
    const member = await createMember('member@example.com');

    expect((await getAs(`/${manager.id}`, receptionist)).status).toBe(404);
    expect((await getAs(`/${coach.id}`, receptionist)).status).toBe(404);
    const detail = await getAs(`/${member.id}`, receptionist);
    expect(detail.status).toBe(200);
    expect((await readResult<{ profile: { healthNotes: string | null } }>(detail)).profile.healthNotes).toBe(
      'Ghi chú riêng',
    );

    expect((await getAs('/', coach)).status).toBe(403);
    expect((await getAs(`/${member.id}`, coach)).status).toBe(403);
    expect((await getAs('/', manager)).status).toBe(200);
  });
});

describe('create staff account', () => {
  test('manager creates a coach who can set a password through the reset flow and log in', async () => {
    spyOn(mailService, 'sendBatch').mockResolvedValue(undefined);
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    const body = {
      email: 'new.coach@example.com',
      fullName: 'Trần Huấn',
      role: 'COACH',
      phone: '0987654321',
      profile: { bio: 'Bơi lội', staffNotes: 'Bị bỏ qua' },
    };

    expect((await postAs('/', receptionist, body)).status).toBe(403);

    const response = await postAs('/', manager, body);
    expect(response.status).toBe(201);
    const created = await readResult<{ id: string; role: string; profile: { bio: string } }>(response);
    expect(created).toMatchObject({ role: 'COACH', profile: { bio: 'Bơi lội' } });
    expect(await prisma.coachProfile.count({ where: { accountId: created.id } })).toBe(1);
    expect(await prisma.receptionistProfile.count({ where: { accountId: created.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { entityId: created.id, action: 'CREATE' } })).toBe(2);
    expect(await prisma.notification.count({ where: { accountId: created.id, sendEmail: true } })).toBe(1);

    const duplicate = await postAs('/', manager, { ...body, phone: null });
    expect(duplicate.status).toBe(409);
    expect(await readCode(duplicate)).toBe('EMAIL_TAKEN');

    let otp = '';
    spyOn(mailService, 'sendOtp').mockImplementation(async (_to, _purpose, code) => {
      otp = code;
    });
    await authService.sendOtp({ email: body.email, purpose: 'PASSWORD_RESET', captchaToken: 'test' });
    await authService.resetPassword({
      email: body.email,
      otp,
      password: 'NewPassword1!',
      confirmPassword: 'NewPassword1!',
    });

    const { account } = await authService.login({ email: body.email, password: 'NewPassword1!' }, {});
    expect(account.id).toBe(created.id);
    expect(account.emailVerifiedAt).not.toBeNull();
  });
});
