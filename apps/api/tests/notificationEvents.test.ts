import type { MaintenancePreview } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { prisma } from '~/configs/db';
import { addDays, todayInCenter } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { buildFetcher, createAccount, readResult, startServer } from './helpers/http';
import { seedBooking, seedFacility, seedSession } from './helpers/schedule';

let server: Server;
let api: (path: string) => ReturnType<typeof buildFetcher>;

beforeAll(async () => {
  ({ server } = await startServer('/'));
  const { port } = server.address() as AddressInfo;
  api = (path) => buildFetcher(`http://localhost:${port}/api/v1${path}`);
});

afterAll(() => server.close());

beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
});

const titlesOf = async (accountId: string) =>
  (await prisma.notification.findMany({ where: { accountId } })).map(({ title }) => title);

describe('staff notifications', () => {
  test('a new support request reaches receptionists and managers', async () => {
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
  });

  test('receptionists hear about a guest booking moved by maintenance', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    const day = addDays(todayInCenter(), 2);
    const [court, spare] = await Promise.all([seedFacility(1), seedFacility(1)]);
    const session = await seedSession(court.id, '20:00', '21:00', { date: day });
    const { sportId } = await prisma.course.findUniqueOrThrow({ where: { id: session.class.courseId } });
    await prisma.facilitySport.createMany({
      data: [court, spare].map(({ id }) => ({ facilityId: id, sportId })),
    });
    const booking = await seedBooking(court.id, '08:00', '09:00', { date: day });
    const window = {
      facilityId: court.id,
      startAt: `${day}T07:00:00+07:00`,
      endAt: `${day}T12:00:00+07:00`,
      reason: 'Thay mặt sân',
    };

    const preview = await readResult<MaintenancePreview>(
      await api('/maintenances')('POST', '/preview', manager, window),
    );
    expect(preview.affectedBookings.map(({ id }) => id)).toEqual([booking.id]);
    const created = await api('/maintenances')('POST', '', manager, {
      ...window,
      bookingMoves: [{ bookingId: booking.id, facilityId: spare.id }],
    });

    expect(created.status).toBe(201);
    expect(await titlesOf(receptionist.id)).toEqual(['Khách vãng lai bị chuyển sân']);
  });
});
