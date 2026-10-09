import type { Maintenance, MaintenancePreview, MaintenanceResult } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { addDays, todayInCenter } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { createAccount, readCode, readResult, startServer } from './helpers/http';
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

const setup = async (capacities: number[]) => {
  const manager = await createAccount('MANAGER', 'manager@example.com');
  const member = await createAccount('MEMBER', 'member@example.com');
  const day = addDays(todayInCenter(), 2);
  const facilities = await Promise.all(capacities.map((capacity) => seedFacility(capacity)));
  const session = await seedSession(facilities[0]!.id, '10:00', '11:00', { date: day });
  const { sportId } = await prisma.course.findUniqueOrThrow({ where: { id: session.class.courseId } });
  await prisma.facilitySport.createMany({ data: facilities.map(({ id }) => ({ facilityId: id, sportId })) });
  const window = {
    facilityId: facilities[0]!.id,
    startAt: `${day}T07:00:00+07:00`,
    endAt: `${day}T12:00:00+07:00`,
    reason: 'Thay mặt sân',
  };
  return { manager, member, day, facilities, session, window };
};

describe('maintenance', () => {
  test('preview lists affected bookings and sessions with free same-sport facilities and writes nothing', async () => {
    const { manager, member, day, facilities, session, window } = await setup([1, 1, 1]);
    const [court, full, spare] = facilities as [(typeof facilities)[0], (typeof facilities)[0], (typeof facilities)[0]];
    const booking = await seedBooking(court.id, '08:00', '09:00', { date: day, accountId: member.id });
    await seedBooking(full.id, '08:00', '09:00', { date: day });
    await seedBooking(spare.id, '08:00', '09:00', { date: day });

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

  test('confirming moves every affected booking and session, including a booking made after the preview', async () => {
    const { manager, member, day, facilities, session, window } = await setup([1, 2]);
    const [court, spare] = facilities as [(typeof facilities)[0], (typeof facilities)[0]];
    const first = await seedBooking(court.id, '08:00', '09:00', { date: day, accountId: member.id });
    expect(
      (await readResult<MaintenancePreview>(await request('POST', '/preview', manager, window))).affectedBookings,
    ).toHaveLength(1);
    const late = await seedBooking(court.id, '09:00', '10:00', { date: day });

    const sessionResolutions = [{ sessionId: session.id, action: 'MOVE_FACILITY', facilityId: spare.id }];
    const stale = await request('POST', '/', manager, {
      ...window,
      bookingMoves: [{ bookingId: first.id, facilityId: spare.id }],
      sessionResolutions,
    });
    expect(stale.status).toBe(422);
    expect(await prisma.facilityMaintenance.count()).toBe(0);

    const done = await request('POST', '/', manager, {
      ...window,
      bookingMoves: [first, late].map(({ id }) => ({ bookingId: id, facilityId: spare.id })),
      sessionResolutions,
    });
    expect(done.status).toBe(201);
    expect(await readResult<MaintenanceResult>(done)).toMatchObject({ movedBookings: 2, sessionsUpdated: 1 });
    expect(await prisma.facilityBooking.count({ where: { facilityId: spare.id } })).toBe(2);
    expect(await prisma.classSession.findUniqueOrThrow({ where: { id: session.id } })).toMatchObject({
      facilityId: spare.id,
    });
    expect(await prisma.notification.count({ where: { accountId: member.id, type: 'BOOKING' } })).toBe(1);
  });

  test('a booking with no free facility blocks the maintenance and nothing changes', async () => {
    const { manager, day, facilities, session, window } = await setup([1, 1]);
    const [court, other] = facilities as [(typeof facilities)[0], (typeof facilities)[0]];
    const booking = await seedBooking(court.id, '08:00', '09:00', { date: day });
    await seedBooking(other.id, '08:00', '09:00', { date: day });

    const blocked = await request('POST', '/', manager, {
      ...window,
      bookingMoves: [{ bookingId: booking.id, facilityId: other.id }],
      sessionResolutions: [{ sessionId: session.id, action: 'MOVE_FACILITY', facilityId: other.id }],
    });
    expect([blocked.status, await readCode(blocked)]).toEqual([409, 'MAINTENANCE_BLOCKED']);
    expect(await prisma.facilityMaintenance.count()).toBe(0);
    expect(await prisma.facilityBooking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({
      facilityId: court.id,
    });
  });
});
