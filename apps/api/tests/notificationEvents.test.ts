import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { prisma } from '~/configs/db';
import alertJobService from '~/services/alertJob.service';
import mailService from '~/services/mail.service';
import { toCenterDateTime, todayInCenter } from '~/utils/time';
import { setupAttendance } from './helpers/attendance';
import { resetDatabase } from './helpers/db';
import { buildFetcher, createAccount, startServer } from './helpers/http';

let server: Server;
let api: (path: string) => ReturnType<typeof buildFetcher>;

beforeAll(async () => {
  ({ server } = await startServer('/'));
  const { port } = server.address() as AddressInfo;
  api = (path) => buildFetcher(`http://localhost:${port}/api/v1${path}`);
});

afterAll(() => server.close());
beforeEach(resetDatabase);

const titlesOf = async (accountId: string) =>
  (await prisma.notification.findMany({ where: { accountId }, orderBy: { createdAt: 'asc' } })).map(
    ({ title }) => title,
  );

describe('notifications for events nobody was told about', () => {
  test('a new support request reaches receptionists and managers, and a locked member only gets an email', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    const manager = await createAccount('MANAGER', 'manager@example.com');

    const created = await api('/support-requests')('POST', '', member, {
      category: 'BOOKING',
      subject: 'Sân bị trùng người',
      description: 'Đến sân thì đã có nhóm khác.',
    });
    expect(created.status).toBe(201);
    expect(await titlesOf(receptionist.id)).toEqual(['Yêu cầu hỗ trợ mới']);
    expect(await titlesOf(manager.id)).toEqual(['Yêu cầu hỗ trợ mới']);

    const send = spyOn(mailService, 'send').mockResolvedValue();
    await api('/users')('PATCH', `/${member.id}/status`, manager, { status: 'BANNED', reason: 'Vi phạm nội quy' });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'member@example.com', subject: '[Sports Center] Tài khoản đã bị khóa' }),
    );
    expect(await prisma.notification.count({ where: { accountId: member.id } })).toBe(0);
    send.mockRestore();
  });

  test('the hourly job reminds coaches about attendance and reviews and sends one morning digest', async () => {
    const { coach, manager } = await setupAttendance();
    const member = await createAccount('MEMBER', 'asker@example.com');
    await prisma.supportRequest.create({
      data: { accountId: member.id, category: 'OTHER', subject: 'Hỏi', description: 'Hỏi giờ mở cửa' },
    });
    const morning = toCenterDateTime(todayInCenter(), 8 * 60);

    await alertJobService.run(morning);
    await alertJobService.run(morning);

    expect((await titlesOf(coach.id)).sort()).toEqual(
      ['Buổi học chưa điểm danh', 'Đến hạn đánh giá cuối khóa', 'Đến hạn đánh giá giữa khóa'].sort(),
    );
    expect(await prisma.notification.findFirstOrThrow({ where: { accountId: manager.id } })).toMatchObject({
      title: 'Việc cần xử lý',
      message: 'Yêu cầu hỗ trợ mới: 1',
    });
  });
});
