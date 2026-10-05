import type { Paginated, SupportRequest } from '@sports-center/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import notificationService from '~/services/notification.service';
import { resetDatabase } from './helpers/db';
import type { buildFetcher } from './helpers/http';
import { createAccount, readCode, readResult, startServer } from './helpers/http';

let server: Server;
let req: ReturnType<typeof buildFetcher>;
let member: Awaited<ReturnType<typeof createAccount>>;
let other: typeof member;
let receptionist: typeof member;
let manager: typeof member;
let coach: typeof member;
const body = { category: 'PAYMENT', subject: ' Kiểm tra ví ', description: ' Chưa nhận được tiền ' };
const base = '/support-requests';

beforeAll(async () => {
  ({ server, request: req } = await startServer(''));
});
afterAll(() => server.close());
beforeEach(async () => {
  await resetDatabase();
  member = await createAccount('MEMBER', 'member@example.com');
  other = await createAccount('MEMBER', 'other@example.com');
  receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
  manager = await createAccount('MANAGER', 'manager@example.com');
  coach = await createAccount('COACH', 'coach@example.com');
});
afterEach(() => mock.restore());

const create = async () => readResult<SupportRequest>(await req('POST', base, member, body));
const patch = (id: string, payload: unknown, viewer = receptionist) => req('PATCH', `${base}/${id}`, viewer, payload);

describe('support requests', () => {
  test('member creates a trimmed OPEN ticket and sees only own tickets', async () => {
    const response = await req('POST', base, member, { ...body, accountId: other.id, status: 'CLOSED' });
    expect(response.status).toBe(201);
    const ticket = await readResult<SupportRequest>(response);
    expect(ticket).toMatchObject({
      account: { id: member.id, fullName: 'MEMBER' },
      subject: 'Kiểm tra ví',
      description: 'Chưa nhận được tiền',
      status: 'OPEN',
      resolutionNote: null,
      handledBy: null,
      resolvedAt: null,
    });
    expect(typeof ticket.createdAt).toBe('string');
    await req('POST', base, other, body);
    expect(await readResult<SupportRequest[]>(await req('GET', '/me/support-requests', member))).toMatchObject([
      { id: ticket.id },
    ]);
    expect(await prisma.auditLog.count({ where: { entityType: 'SUPPORT_REQUEST', action: 'CREATE' } })).toBe(2);
  });

  test('detail is visible only to the owner and staff; deleted and missing tickets return 404', async () => {
    const ticket = await create();
    for (const viewer of [member, receptionist, manager]) {
      expect((await req('GET', `${base}/${ticket.id}`, viewer)).status).toBe(200);
    }
    expect((await req('GET', `${base}/${ticket.id}`, other)).status).toBe(404);
    expect((await req('GET', `${base}/${ticket.id}`, coach)).status).toBe(403);
    expect((await patch(crypto.randomUUID(), { status: 'IN_PROGRESS' })).status).toBe(404);
    await prisma.supportRequest.update({ where: { id: ticket.id }, data: { deletedAt: new Date() } });
    expect((await req('GET', `${base}/${ticket.id}`, member)).status).toBe(404);
    expect((await patch(ticket.id, { status: 'IN_PROGRESS' })).status).toBe(404);
    expect(await readResult<SupportRequest[]>(await req('GET', '/me/support-requests', member))).toEqual([]);
    expect((await readResult<Paginated<SupportRequest>>(await req('GET', base, manager))).total).toBe(0);
  });

  test('staff filter by status, category and search; pagination uses the filtered total', async () => {
    const ticket = await create();
    await req('POST', base, member, { ...body, category: 'BOOKING', subject: 'Đổi giờ sân' });
    await req('POST', base, other, body);
    await patch(ticket.id, { status: 'IN_PROGRESS' });
    for (const viewer of [receptionist, manager]) {
      const page = await readResult<Paginated<SupportRequest>>(
        await req('GET', `${base}?status=OPEN&category=PAYMENT&page=1&limit=1`, viewer),
      );
      expect(page).toMatchObject({ total: 1, page: 1, limit: 1 });
      expect(page.items).toHaveLength(1);
      expect(page.items[0]?.account.id).toBe(other.id);
      const second = await readResult<Paginated<SupportRequest>>(await req('GET', `${base}?limit=1&page=2`, viewer));
      expect(second.total).toBe(3);
      expect(second.items).toHaveLength(1);
      const search = await readResult<Paginated<SupportRequest>>(await req('GET', `${base}?q=MEMBER`, viewer));
      expect(search.total).toBe(3);
    }
  });

  test('role gates and authentication prevent unauthorized creation, listing and updates', async () => {
    const ticket = await create();
    for (const viewer of [manager, receptionist, coach]) {
      expect((await req('POST', base, viewer, body)).status).toBe(403);
      expect((await req('GET', '/me/support-requests', viewer)).status).toBe(403);
    }
    for (const viewer of [member, other, coach]) {
      expect((await req('GET', base, viewer)).status).toBe(403);
      expect((await patch(ticket.id, { status: 'IN_PROGRESS' }, viewer)).status).toBe(403);
    }
    const { port } = server.address() as { port: number };
    for (const path of [base, '/me/support-requests', `${base}/${ticket.id}`]) {
      expect((await fetch(`http://localhost:${port}/api/v1${path}`)).status).toBe(401);
    }
  });

  test('staff advance one step, preserve the first handler and resolvedAt, and notify only the member', async () => {
    const ticket = await create();
    const inProgress = await patch(ticket.id, { status: 'IN_PROGRESS', resolutionNote: 'Đang kiểm tra' });
    expect(inProgress.status).toBe(200);
    expect(await readResult<SupportRequest>(inProgress)).toMatchObject({
      handledBy: { id: receptionist.id },
      resolvedAt: null,
    });
    const resolved = await patch(ticket.id, { status: 'RESOLVED', resolutionNote: ' Đã cộng ví ' }, manager);
    expect(resolved.status).toBe(200);
    const result = await readResult<SupportRequest>(resolved);
    expect(result.status).toBe('RESOLVED');
    expect(result.resolutionNote).toBe('Đã cộng ví');
    expect(result.resolvedAt).not.toBeNull();
    const closed = await patch(ticket.id, { status: 'CLOSED' }, manager);
    expect(closed.status).toBe(200);
    expect(await readResult<SupportRequest>(closed)).toMatchObject({
      status: 'CLOSED',
      handledBy: { id: receptionist.id },
      resolvedAt: result.resolvedAt,
      resolutionNote: 'Đã cộng ví',
    });
    const notifications = await prisma.notification.findMany({ where: { referenceId: ticket.id } });
    expect(notifications).toHaveLength(3);
    expect(
      notifications.every(
        (n) =>
          n.accountId === member.id && n.type === 'SUPPORT' && n.referenceType === 'SUPPORT_REQUEST' && !n.sendEmail,
      ),
    ).toBe(true);
    expect(notifications.some((n) => n.message.includes('Đã cộng ví'))).toBe(true);
  });

  test('backward, repeated and skipped transitions return 409 without writing or notifying', async () => {
    const ticket = await create();
    for (const status of ['OPEN', 'RESOLVED', 'CLOSED']) {
      const response = await patch(ticket.id, { status, resolutionNote: 'Phản hồi' });
      expect(response.status).toBe(409);
      expect(await readCode(response)).toBe('INVALID_STATE');
    }
    await patch(ticket.id, { status: 'IN_PROGRESS' });
    for (const status of ['OPEN', 'IN_PROGRESS', 'CLOSED'])
      expect((await patch(ticket.id, { status })).status).toBe(409);
    await patch(ticket.id, { status: 'RESOLVED', resolutionNote: 'Đã xong' });
    for (const status of ['OPEN', 'IN_PROGRESS', 'RESOLVED'])
      expect((await patch(ticket.id, { status })).status).toBe(409);
    expect(await prisma.notification.count()).toBe(2);
    expect(await prisma.auditLog.count({ where: { action: 'UPDATE' } })).toBe(2);
  });

  test('resolution needs a nonblank response; a saved response can be reused', async () => {
    const ticket = await create();
    await patch(ticket.id, { status: 'IN_PROGRESS' });
    for (const payload of [{ status: 'RESOLVED' }, { status: 'RESOLVED', resolutionNote: '  ' }]) {
      expect((await patch(ticket.id, payload)).status).toBe(422);
    }
    expect((await patch(ticket.id, { resolutionNote: 'Đã xong' })).status).toBe(200);
    expect((await patch(ticket.id, { status: 'RESOLVED' })).status).toBe(200);
    expect((await patch(ticket.id, { resolutionNote: '' })).status).toBe(422);
    expect((await patch(ticket.id, { status: 'CLOSED', resolutionNote: '' })).status).toBe(422);
    expect((await patch(ticket.id, { status: 'CLOSED' })).status).toBe(200);
    expect((await patch(ticket.id, { resolutionNote: 'Sửa' })).status).toBe(409);
    expect((await patch(ticket.id, { status: 'OPEN' })).status).toBe(409);
  });

  test('saving the same response is a no-op; changing it notifies the member', async () => {
    const ticket = await create();
    await patch(ticket.id, { resolutionNote: 'Đang kiểm tra' });
    const before = await prisma.supportRequest.findUniqueOrThrow({ where: { id: ticket.id } });
    await patch(ticket.id, { resolutionNote: ' Đang kiểm tra ' });
    const after = await prisma.supportRequest.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.updatedAt).toEqual(before.updatedAt);
    expect(await prisma.notification.count()).toBe(1);
    await patch(ticket.id, { resolutionNote: 'Có kết quả mới' });
    expect(await prisma.notification.count()).toBe(2);
  });

  test('invalid fields, UUIDs and filters return 422', async () => {
    const ticket = await create();
    for (const payload of [
      { ...body, category: 'INVALID' },
      { ...body, subject: ' ' },
      { ...body, description: ' ' },
      { ...body, subject: 'x'.repeat(256) },
      { ...body, description: 'x'.repeat(5001) },
    ]) {
      expect((await req('POST', base, member, payload)).status).toBe(422);
    }
    for (const payload of [{}, { status: 'INVALID' }, { resolutionNote: null }, { resolutionNote: 'x'.repeat(5001) }]) {
      expect((await patch(ticket.id, payload)).status).toBe(422);
    }
    expect((await patch('not-a-uuid', { status: 'IN_PROGRESS' })).status).toBe(422);
    for (const query of ['status=INVALID', 'category=INVALID', 'page=0', 'limit=0', 'limit=101']) {
      expect((await req('GET', `${base}?${query}`, manager)).status).toBe(422);
    }
  });

  test('concurrent requests for the same transition yield one success and one conflict', async () => {
    const ticket = await create();
    const responses = await Promise.all([
      patch(ticket.id, { status: 'IN_PROGRESS', resolutionNote: 'A' }),
      patch(ticket.id, { status: 'IN_PROGRESS', resolutionNote: 'B' }, manager),
    ]);
    expect(responses.map((res) => res.status).sort()).toEqual([200, 409]);
    expect(await prisma.notification.count()).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'UPDATE' } })).toBe(1);
  });

  test('notification failure rolls back the ticket and audit update', async () => {
    const ticket = await create();
    spyOn(notificationService, 'create').mockRejectedValueOnce(new Error('notification failed'));
    expect((await patch(ticket.id, { status: 'IN_PROGRESS' })).status).toBe(500);
    expect(await prisma.supportRequest.findUniqueOrThrow({ where: { id: ticket.id } })).toMatchObject({
      status: 'OPEN',
      handledById: null,
    });
    expect(await prisma.notification.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: 'UPDATE' } })).toBe(0);
  });
});
