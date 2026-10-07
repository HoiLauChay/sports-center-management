import { beforeEach, describe, expect, it, spyOn } from 'bun:test';

if (typeof localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

import type { Person } from '@sports-center/shared';
import {
  getClassesTaughtByCoach,
  getClassStudents,
  getOpenClassesForCoach,
  registerCoachForClass,
  withdrawCoachRegistration,
} from '../src/features/classes/mocks/classAdmin';
import { classesStore, generateSessions } from '../src/features/classes/mocks/classes';
import { coachClassesService } from '../src/features/classes/services/coachClasses.service';
import type { ClassStatus, WeeklySlot } from '../src/features/classes/types';
import { privateApi } from '../src/lib/http';
import { MockApiError } from '../src/lib/mock/errors';
import { addDays, todayVN } from '../src/lib/time';

const ME: Person = { id: 'coach-me', fullName: 'Lê Văn An' };
const OTHER: Person = { id: 'coach-other', fullName: 'Phạm Thu Hà' };
const GYM = { id: 'sport-gym', name: 'Gym' };
const TENNIS = { id: 'sport-tennis', name: 'Tennis' };
const APPROVED = [GYM.id];
const ROOM = { id: 'fac-gym', name: 'Phòng Gym A' };

/** Puts one class (with its sessions) straight into the mock store. */
function addClass(input: {
  sport?: typeof GYM;
  status?: ClassStatus;
  coach?: Person | null;
  slot?: WeeklySlot;
  start?: number;
}) {
  const id = crypto.randomUUID();
  const slot = input.slot ?? { dayOfWeek: 2, startTime: '18:00', endTime: '19:00' };
  const sport = input.sport ?? GYM;
  classesStore.update((state) => {
    state.classes.push({
      id,
      name: `${sport.name} ${id.slice(0, 4)}`,
      course: {
        id: crypto.randomUUID(),
        name: `${sport.name} cơ bản`,
        description: null,
        sport,
        totalSessions: 4,
        price: 1,
        thumbnailUrl: null,
      },
      status: input.status ?? 'DRAFT',
      weeklySchedule: [slot],
      facility: ROOM,
      coach: input.coach ?? null,
      minStudents: 1,
      maxStudents: 10,
      cancelReason: null,
      baseEnrolled: 0,
    });
    state.sessions.push(...generateSessions(id, ROOM, addDays(todayVN(), input.start ?? 7), [slot], 4));
  });
  return id;
}

async function rejects(run: () => unknown, code: string) {
  try {
    await run();
  } catch (err) {
    expect(err).toBeInstanceOf(MockApiError);
    expect((err as MockApiError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}`);
}

beforeEach(() => {
  classesStore.update((state) => {
    state.classes = [];
    state.sessions = [];
    state.registrations = [];
    state.seeded = true;
    state.adminSeeded = true;
  });
});

describe('Issue #174: Lớp cần HLV', () => {
  it('acceptance criteria: only classes of approved sports', () => {
    const gym = addClass({});
    addClass({ sport: TENNIS });

    expect(getOpenClassesForCoach(ME.id, APPROVED).map((item) => item.id)).toEqual([gym]);
  });

  it('only drafts / pending approval without another coach', () => {
    const draft = addClass({ status: 'DRAFT' });
    const pending = addClass({ status: 'PENDING_APPROVAL' });
    addClass({ status: 'OPEN' });
    addClass({ status: 'PENDING_APPROVAL', coach: OTHER });

    expect(
      getOpenClassesForCoach(ME.id, APPROVED)
        .map((item) => item.id)
        .sort(),
    ).toEqual([draft, pending].sort());
  });

  it('registering moves a draft to pending approval and shows the registration', () => {
    const id = addClass({ status: 'DRAFT' });

    expect(registerCoachForClass(id, ME, APPROVED).status).toBe('PENDING_APPROVAL');
    const item = getOpenClassesForCoach(ME.id, APPROVED)[0]!;
    expect(item.registration?.status).toBe('PENDING');
    expect(item.pendingRegistrations).toBe(1);
  });

  it('refuses a second registration and a sport that is not approved', async () => {
    const id = addClass({});
    registerCoachForClass(id, ME, APPROVED);

    await rejects(() => registerCoachForClass(id, ME, APPROVED), 'ALREADY_REGISTERED');
    await rejects(() => registerCoachForClass(addClass({ sport: TENNIS }), ME, APPROVED), 'FORBIDDEN_SPORT');
  });

  it('shows and refuses a clash with a class the coach already teaches', async () => {
    addClass({ status: 'OPEN', coach: ME });
    const id = addClass({});

    expect(getOpenClassesForCoach(ME.id, APPROVED).find((item) => item.id === id)?.clash).toContain('trùng lịch');
    await rejects(() => registerCoachForClass(id, ME, APPROVED), 'SCHEDULE_CONFLICT');
  });

  it('a pending registration can be withdrawn once', async () => {
    const id = addClass({});
    registerCoachForClass(id, ME, APPROVED);

    withdrawCoachRegistration(id, ME.id);
    expect(getOpenClassesForCoach(ME.id, APPROVED)[0]!.registration).toBeNull();
    await rejects(() => withdrawCoachRegistration(id, ME.id), 'INVALID_STATE');
  });

  it('reads approved specializations from GET /coach/specializations', async () => {
    const get = spyOn(privateApi, 'get').mockResolvedValue({
      data: {
        result: [
          { id: 's1', sport: GYM, status: 'APPROVED' },
          { id: 's2', sport: TENNIS, status: 'PENDING' },
        ],
      },
    });

    const approved = await coachClassesService.approvedSpecializations();

    expect(get).toHaveBeenCalledWith('/coach/specializations');
    expect(approved.map((item) => item.sport.id)).toEqual([GYM.id]);
    get.mockRestore();
  });
});

describe('Issue #174 / UC_2.21: Lớp phụ trách', () => {
  it('lists only the classes this coach teaches, with the session to take attendance for', () => {
    const mine = addClass({ status: 'OPEN', coach: ME, start: -3 });
    addClass({ status: 'OPEN', coach: OTHER });

    const list = getClassesTaughtByCoach(ME.id);
    expect(list.map((item) => item.id)).toEqual([mine]);
    expect(list[0]!.attendanceSessionId).not.toBeNull();
  });

  it('returns the students of a class', () => {
    const id = addClass({ status: 'OPEN', coach: ME });
    expect(Array.isArray(getClassStudents(id))).toBe(true);
  });
});
