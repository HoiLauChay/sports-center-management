import type { Maintenance, MaintenancePreview } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { addDays, todayInCenter } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { createAccount, readResult, startServer } from './helpers/http';
import { seedBooking, seedFacility, seedSession } from './helpers/schedule';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];

beforeAll(async () => {
  ({ server, request } = await startServer('/maintenances'));
});

afterAll(() => server.close());

beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
});

describe('maintenance', () => {
  test('preview lists affected bookings and sessions with free same-sport facilities and writes nothing', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const member = await createAccount('MEMBER', 'member@example.com');
    const day = addDays(todayInCenter(), 2);
    const [court, full, spare] = await Promise.all([seedFacility(1), seedFacility(1), seedFacility(1)]);
    const session = await seedSession(court.id, '10:00', '11:00', { date: day });
    const sport = await prisma.course.findUniqueOrThrow({ where: { id: session.class.courseId } });
    await prisma.facilitySport.createMany({
      data: [court, full, spare].map(({ id }) => ({ facilityId: id, sportId: sport.sportId })),
    });
    const booking = await seedBooking(court.id, '08:00', '09:00', { date: day, accountId: member.id });
    await seedBooking(full.id, '08:00', '09:00', { date: day });
    await seedBooking(spare.id, '08:00', '09:00', { date: day });

    const window = {
      facilityId: court.id,
      startAt: `${day}T07:00:00+07:00`,
      endAt: `${day}T12:00:00+07:00`,
      reason: 'Thay mặt sân',
    };
    const preview = await readResult<MaintenancePreview>(await request('POST', '/preview', manager, window));
    expect(preview.affectedBookings).toMatchObject([
      { id: booking.id, account: { id: member.id }, startTime: '08:00', alternatives: [] },
    ]);
    expect(preview.affectedSessions).toMatchObject([
      { id: session.id, startTime: '10:00', alternatives: [{ id: full.id }, { id: spare.id }] },
    ]);
    expect(await prisma.facilityMaintenance.count()).toBe(0);
    expect(await prisma.facilityBooking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({
      facilityId: court.id,
    });

    await prisma.facilityMaintenance.create({
      data: { ...window, startAt: new Date(window.startAt), endAt: new Date(window.endAt), createdById: manager.id },
    });
    const listed = await readResult<Maintenance[]>(await request('GET', `/?facilityId=${court.id}`, manager));
    expect(listed).toMatchObject([{ facility: { id: court.id }, reason: 'Thay mặt sân' }]);
  });
});
