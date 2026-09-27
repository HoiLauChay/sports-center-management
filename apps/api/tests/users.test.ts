import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import app from '~/app';
import { prisma } from '~/configs/db';
import type { Role } from '~/generated/prisma/client';
import { signAccessToken } from '~/utils/jwt';
import { resetDatabase } from './helpers/db';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/api/v1/users`;
});

afterAll(() => server.close());
beforeEach(resetDatabase);

const createAccount = (role: 'MANAGER' | 'RECEPTIONIST' | 'COACH' | 'MEMBER', email: string) =>
  prisma.account.create({
    data: {
      email,
      passwordHash: 'hash',
      fullName: email.startsWith('member') ? 'Nguyễn Minh' : role,
      phone: role === 'MEMBER' ? '0912345678' : null,
      role,
      passwordChangedAt: new Date('2020-01-01'),
      ...(role === 'MANAGER' && { managerProfile: { create: {} } }),
      ...(role === 'RECEPTIONIST' && { receptionistProfile: { create: {} } }),
      ...(role === 'COACH' && { coachProfile: { create: {} } }),
      ...(role === 'MEMBER' && { memberProfile: { create: { healthNotes: 'Ghi chú riêng' } } }),
    },
  });

const getAs = (path: string, viewer: { id: string; role: Role }) =>
  fetch(baseUrl + path, { headers: { Cookie: `access_token=${signAccessToken(viewer.id, viewer.role)}` } });

interface ListResult {
  items: { id: string; passwordHash?: string }[];
  total: number;
  page: number;
  limit: number;
}

const readResult = async <T>(response: Response) => ((await response.json()) as { result: T }).result;

describe('user list and detail permissions', () => {
  test('manager searches and filters roles while receptionist only sees members in items and total', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    const member = await createAccount('MEMBER', 'member@example.com');
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
    const member = await createAccount('MEMBER', 'member@example.com');

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
