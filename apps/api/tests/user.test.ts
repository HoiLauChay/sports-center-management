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
const patchAs = (path: string, viewer: Viewer, body: unknown) => request('PATCH', path, viewer, body);

const isoDate = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

const createCoachClass = async (coachId: string, name: string, startOffsetDays: number) => {
  const sport = await prisma.sport.create({ data: { name: `Môn ${name}` } });
  const course = await prisma.course.create({
    data: { name: `Khóa ${name}`, sportId: sport.id, totalSessions: 10, price: 500000 },
  });
  const facility = await prisma.facility.create({
    data: { name: `Hồ ${name}`, type: 'ROOM', capacityPerSlot: 20, pricePerSlot: 100000 },
  });
  return prisma.class.create({
    data: {
      courseId: course.id,
      facilityId: facility.id,
      coachId,
      name,
      maxStudents: 20,
      weeklySchedule: [],
      status: 'OPEN',
      startDate: new Date(isoDate(startOffsetDays)),
      endDate: new Date(isoDate(startOffsetDays + 30)),
    },
  });
};

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

  test('receptionist cannot fetch staff by ID and coach cannot read unassigned members', async () => {
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
    expect((await getAs(`/${member.id}`, coach)).status).toBe(404);
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

describe('update account', () => {
  test('manager edits account info and role profile while phone conflicts are reported on the phone field', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    const member = await createMember('member@example.com');
    await createAccount('COACH', 'coach@example.com', { phone: '0987654321' });

    const body = { fullName: 'Nguyễn Minh Anh', profile: { healthNotes: 'Đau gối', staffNotes: 'Bị bỏ qua' } };
    expect((await patchAs(`/${member.id}`, receptionist, body)).status).toBe(403);

    const response = await patchAs(`/${member.id}`, manager, body);
    expect(response.status).toBe(200);
    expect(await readResult(response)).toMatchObject({
      fullName: 'Nguyễn Minh Anh',
      profile: { healthNotes: 'Đau gối' },
    });
    expect(await prisma.auditLog.count({ where: { entityId: member.id, accountId: manager.id } })).toBe(1);

    const staff = await patchAs(`/${receptionist.id}`, manager, { profile: { staffNotes: 'Ca sáng' } });
    expect(await readResult(staff)).toMatchObject({ profile: { staffNotes: 'Ca sáng' } });

    const conflict = await patchAs(`/${member.id}`, manager, { phone: '0987654321' });
    expect(conflict.status).toBe(409);
    const error = (await conflict.json()) as { code: string; errors: { path: string }[] };
    expect(error.code).toBe('PHONE_TAKEN');
    expect(error.errors[0]?.path).toBe('body.phone');
  });
});

describe('update account status', () => {
  test('banning a member revokes sessions so the next request is rejected', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const member = await createMember('member@example.com');
    await prisma.refreshToken.create({
      data: { tokenHash: 'hash', accountId: member.id, expiresAt: new Date(Date.now() + 86_400_000) },
    });

    expect((await getAs('/', manager)).status).toBe(200);
    const response = await patchAs(`/${member.id}/status`, manager, { status: 'BANNED', reason: 'Gian lận' });
    expect(response.status).toBe(200);
    expect(await readResult(response)).toMatchObject({ status: 'BANNED' });

    expect(await prisma.refreshToken.count({ where: { accountId: member.id, revokedAt: null } })).toBe(0);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: member.id } });
    expect(log.newValues).toEqual({ status: 'BANNED', statusReason: 'Gian lận' });

    const blocked = await request('GET', '/', member);
    expect(blocked.status).toBe(401);

    expect((await patchAs(`/${manager.id}/status`, manager, { status: 'INACTIVE' })).status).toBe(403);
  });

  test('coach with an in-progress class cannot be deactivated; upcoming classes lose their coach', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const coach = await createAccount('COACH', 'coach@example.com');
    const member = await createMember('member@example.com');

    const running = await createCoachClass(coach.id, 'Lớp đang học', -5);
    const blocked = await patchAs(`/${coach.id}/status`, manager, { status: 'INACTIVE' });
    expect(blocked.status).toBe(409);
    expect(await readCode(blocked)).toBe('HAS_DEPENDENCIES');
    expect((await prisma.account.findUniqueOrThrow({ where: { id: coach.id } })).status).toBe('ACTIVE');

    const replacement = await createAccount('COACH', 'coach2@example.com');
    await prisma.class.update({ where: { id: running.id }, data: { coachId: replacement.id } });
    const upcoming = await createCoachClass(coach.id, 'Lớp sắp mở', 7);

    const response = await patchAs(`/${coach.id}/status`, manager, { status: 'INACTIVE' });
    expect(response.status).toBe(200);

    const updated = await prisma.class.findUniqueOrThrow({ where: { id: upcoming.id } });
    expect(updated).toMatchObject({ coachId: null, status: 'PENDING_APPROVAL' });
    expect(
      await prisma.notification.count({ where: { accountId: manager.id, referenceId: upcoming.id, type: 'CLASS' } }),
    ).toBe(1);
    expect(await prisma.notification.count({ where: { accountId: member.id } })).toBe(0);
  });
});
