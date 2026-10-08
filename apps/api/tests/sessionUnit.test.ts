import { updateSessionBodySchema } from '@sports-center/shared';
import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { prisma } from '~/configs/db';
import { Prisma } from '~/generated/prisma/client';
import facilityRepository from '~/repositories/facility.repository';
import scheduleRepository from '~/repositories/schedule.repository';
import sessionRepository from '~/repositories/session.repository';
import auditService from '~/services/audit.service';
import notificationService from '~/services/notification.service';
import scheduleService, { scheduleConflict } from '~/services/schedule.service';
import sessionService from '~/services/session.service';
import { addDays, todayInCenter, toDbTime } from '~/utils/time';
import * as transaction from '~/utils/transaction';

afterEach(() => {
  mockCleanup();
});
let mockCleanup = () => {};

const setup = () => {
  const day = addDays(todayInCenter(), 5);
  const events: string[] = [];
  const tx = {
    class: {
      update: async () => {
        events.push('dates');
        return {};
      },
    },
  } as unknown as Prisma.TransactionClient;
  const current = {
    id: 'session',
    classId: 'class',
    facilityId: 'old-room',
    sessionNumber: 1,
    sessionDate: new Date(day),
    startTime: toDbTime(1080),
    endTime: toDbTime(1170),
    status: 'SCHEDULED' as const,
    cancelReason: null,
    noteTitle: null,
    noteContent: null,
    noteAttachments: null,
    noteUpdatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    class: {
      id: 'class',
      name: 'Boxing',
      status: 'OPEN' as const,
      coachId: 'coach',
      startDate: new Date(day),
      endDate: new Date(day),
      course: { sportId: 'sport' },
      enrollments: [{ accountId: 'member-1' }, { accountId: 'member-2' }],
    },
  };
  const facility = {
    id: 'new-room',
    name: 'Room B',
    type: 'ROOM' as const,
    isActive: true,
    capacityPerSlot: 1,
    pricePerSlot: new Prisma.Decimal(0),
    description: null,
    sports: [{ sport: { id: 'sport', name: 'Boxing' } }],
  };
  const updated = { ...current, facilityId: facility.id, facility: { id: facility.id, name: facility.name } };
  const spies = [
    spyOn(transaction, 'runTransaction').mockImplementation(async (fn) => {
      events.push('begin');
      const result = await fn(tx);
      events.push('commit');
      return result;
    }),
    spyOn(transaction, 'withScheduleLock').mockResolvedValue(0),
    spyOn(transaction, 'lockRows').mockResolvedValue(undefined),
  ];
  const find = spyOn(sessionRepository, 'findById').mockResolvedValue(current);
  const room = spyOn(facilityRepository, 'findById').mockResolvedValue(facility);
  const available = spyOn(scheduleService, 'assertAvailable').mockResolvedValue(undefined);
  const update = spyOn(sessionRepository, 'update').mockImplementation(() => {
    events.push('session');
    return Promise.resolve(updated) as unknown as ReturnType<typeof sessionRepository.update>;
  });
  const bounds = spyOn(sessionRepository, 'dateBounds').mockResolvedValue({
    _min: { sessionDate: new Date(day) },
    _max: { sessionDate: new Date(day) },
  });
  const audit = spyOn(auditService, 'record').mockResolvedValue(null);
  const notices = spyOn(notificationService, 'create').mockImplementation(() => {
    events.push('notice');
    return Promise.resolve([{ id: 'notice', sendEmail: true }]) as unknown as ReturnType<
      typeof notificationService.create
    >;
  });
  const emails = spyOn(notificationService, 'sendEmailsAfterCommit').mockImplementation(() => {
    events.push('email');
  });
  mockCleanup = () => {
    [...spies, find, room, available, update, bounds, audit, notices, emails].forEach((spy) => spy.mockRestore());
    mockCleanup = () => {};
  };
  return { current, facility, day, tx, events, find, room, available, update, bounds, audit, notices, emails };
};

describe('session service without database', () => {
  test('checks every student, ignores only itself and emails only after commit', async () => {
    const { available, notices, events, audit, tx } = setup();
    const result = await sessionService.update('manager', 'session', { facilityId: 'new-room' });
    expect(result.facility.id).toBe('new-room');
    expect(available).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        coachId: 'coach',
        accountIds: ['member-1', 'member-2'],
        ignoreSessionIds: ['session'],
        facility: { id: 'new-room', exclusive: true },
      }),
    );
    expect(notices.mock.calls[0]![0].map(({ accountId }) => accountId)).toEqual(['coach', 'member-1', 'member-2']);
    expect(events).toEqual(['begin', 'session', 'dates', 'notice', 'commit', 'email']);
    expect(audit).toHaveBeenCalledTimes(1);
  });

  test('a scheduling conflict exits before any update, audit or notification', async () => {
    const { available, update, audit, notices, emails } = setup();
    available.mockRejectedValue(
      scheduleConflict([{ date: todayInCenter(), startTime: '18:00', endTime: '19:30', reason: 'MEMBER_BUSY' }]),
    );
    await expect(
      sessionService.update('manager', 'session', { date: addDays(todayInCenter(), 6) }),
    ).rejects.toMatchObject({ status: 409, code: 'SCHEDULE_CONFLICT' });
    for (const spy of [update, audit, notices, emails]) expect(spy).not.toHaveBeenCalled();
  });

  test('uses chronological bounds returned after updating, and audits changed class dates', async () => {
    const { bounds, audit } = setup();
    bounds.mockResolvedValue({
      _min: { sessionDate: new Date(addDays(todayInCenter(), 6)) },
      _max: { sessionDate: new Date(addDays(todayInCenter(), 10)) },
    });
    await sessionService.update('manager', 'session', { date: addDays(todayInCenter(), 7) });
    expect(audit).toHaveBeenCalledTimes(2);
    expect(audit.mock.calls[1]![0]).toMatchObject({
      entityType: 'CLASS',
      newValues: { startDate: new Date(addDays(todayInCenter(), 6)) },
    });
  });

  test('checks a partial time against the existing end time', async () => {
    const { update } = setup();
    await expect(sessionService.update('manager', 'session', { startTime: '20:00' })).rejects.toMatchObject({
      status: 422,
    });
    expect(update).not.toHaveBeenCalled();
  });

  test('rejects cancelled and past sessions', async () => {
    const { current, find } = setup();
    find.mockResolvedValue({ ...current, status: 'CANCELLED' });
    await expect(
      sessionService.update('manager', 'session', { date: addDays(todayInCenter(), 7) }),
    ).rejects.toMatchObject({ status: 409, code: 'INVALID_STATE' });
    find.mockResolvedValue({ ...current, sessionDate: new Date(addDays(todayInCenter(), -1)) });
    await expect(
      sessionService.update('manager', 'session', { date: addDays(todayInCenter(), 7) }),
    ).rejects.toMatchObject({ status: 409, code: 'INVALID_STATE' });
  });

  test('identical PATCH does not mutate or notify', async () => {
    const { current, update, notices } = setup();
    await sessionService.update('manager', 'session', { facilityId: current.facilityId });
    expect(update).not.toHaveBeenCalled();
    expect(notices).not.toHaveBeenCalled();
  });
});

describe('session validation and batched member conflicts', () => {
  test('accepts partial changes and rejects cancellation, empty body and malformed values', () => {
    expect(updateSessionBodySchema.safeParse({ date: '2026-12-10' }).success).toBe(true);
    for (const body of [
      {},
      { status: 'CANCELLED' },
      { date: '2026-02-30' },
      { startTime: '20:00', endTime: '19:00' },
    ]) {
      expect(updateSessionBodySchema.safeParse(body).success).toBe(false);
    }
  });

  test('real schedule checker rejects any member booking and ignores the current session', async () => {
    const day = '2026-12-10';
    const spy = spyOn(scheduleRepository, 'findMemberCommitments').mockResolvedValue([
      [{ id: 'booking', bookingDate: new Date(day), startTime: toDbTime(1110), endTime: toDbTime(1170) }],
      [
        {
          id: 'self',
          sessionDate: new Date(day),
          startTime: toDbTime(1080),
          endTime: toDbTime(1170),
          class: { id: 'class', name: 'Boxing' },
        },
      ],
    ]);
    try {
      await expect(
        scheduleService.assertAvailable(prisma, {
          ranges: [{ date: day, start: 1080, end: 1170 }],
          accountIds: ['member-1', 'member-2'],
          ignoreSessionIds: ['self'],
        }),
      ).rejects.toMatchObject({ status: 409, meta: { conflicts: [{ reason: 'MEMBER_BUSY', bookingId: 'booking' }] } });
      expect(spy).toHaveBeenCalledWith(['member-1', 'member-2'], [day], prisma);
    } finally {
      spy.mockRestore();
    }
  });
});
