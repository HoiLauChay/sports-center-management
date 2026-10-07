import { describe, expect, it, spyOn } from 'bun:test';

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

import {
  createCourseBodySchema,
  type CreateClassBody,
  type Facility,
  type ScheduleClash,
  type SystemSettings,
} from '@sports-center/shared';
import * as pricing from '../src/features/checkout/mocks/pricing';

const BADMINTON = { id: crypto.randomUUID(), name: 'Cầu lông' };
const TENNIS = { id: crypto.randomUUID(), name: 'Tennis' };
const COURT = { id: crypto.randomUUID(), name: 'Sân cầu lông 1', isActive: true, sports: [BADMINTON] };
const TENNIS_COURT = { id: crypto.randomUUID(), name: 'Sân tennis 1', isActive: true, sports: [TENNIS] };

spyOn(pricing, 'loadCatalog').mockResolvedValue({
  facilities: [COURT, TENNIS_COURT] as unknown as Facility[],
  settings: { openTime: '06:00', closeTime: '22:00', slotDurationMinutes: 60 } as unknown as SystemSettings,
  packages: [],
});

import { classesDb } from '../src/features/classes/mocks/classes';
import { classAdminService } from '../src/features/classes/services/classAdmin.service';
import { coursesService } from '../src/features/courses/services/courses.service';
import { errorPayload } from '../src/lib/http-errors';
import { MockApiError } from '../src/lib/mock/errors';

const BADMINTON_COURSE = {
  id: crypto.randomUUID(),
  name: 'Cầu lông cơ bản',
  description: 'Kỹ thuật nền tảng',
  sport: BADMINTON,
  totalSessions: 8,
  price: 1_200_000,
  thumbnailUrl: null,
};

spyOn(coursesService, 'list').mockResolvedValue([BADMINTON_COURSE]);

const body = (overrides: Partial<CreateClassBody> = {}): CreateClassBody => ({
  courseId: BADMINTON_COURSE.id,
  name: 'Cầu lông cơ bản K1',
  facilityId: COURT.id,
  startDate: '2027-03-06',
  weeklySchedule: [{ dayOfWeek: 6, startTime: '19:00', endTime: '20:00' }],
  minStudents: 4,
  maxStudents: 12,
  ...overrides,
});

async function createError(input: CreateClassBody): Promise<MockApiError> {
  try {
    await classAdminService.create(input);
  } catch (err) {
    expect(err).toBeInstanceOf(MockApiError);
    return err as MockApiError;
  }
  throw new Error('expected create to fail');
}

describe('Issue #168: tạo lớp học (Manager)', () => {
  it('creates a DRAFT class with every session of the course', async () => {
    const created = await classAdminService.create(body());

    expect(created.status).toBe('DRAFT');
    expect(created.coach).toBeNull();
    expect(classesDb.sessionsOf(created.id)).toHaveLength(BADMINTON_COURSE.totalSessions);
  });

  it('acceptance criteria: a clash lists every colliding session', async () => {
    const first = await classAdminService.create(body({ name: 'Lớp A', weeklySchedule: [slot(2, '07:00', '08:00')] }));
    const firstSessions = classesDb.sessionsOf(first.id);

    const err = await createError(
      body({ name: 'Lớp B', startDate: firstSessions[0]!.date, weeklySchedule: [slot(2, '07:00', '08:00')] }),
    );

    expect(err.code).toBe('SCHEDULE_CONFLICT');
    const conflicts = errorPayload<ScheduleClash[]>(err, 'conflicts')!;
    expect(conflicts).toHaveLength(firstSessions.length);
    expect(conflicts[0]).toMatchObject({
      date: firstSessions[0]!.date,
      reason: 'CLASS_SESSION',
      classSession: { classId: first.id, className: 'Lớp A' },
    });
  });

  it('rejects an empty weekly schedule', async () => {
    const err = await createError(body({ weeklySchedule: [] }));
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.errors?.[0]?.path).toBe('body.weeklySchedule');
  });

  it('rejects min students above max students', async () => {
    const err = await createError(body({ minStudents: 20, maxStudents: 5 }));
    expect(err.errors?.[0]?.path).toBe('body.maxStudents');
  });

  it('rejects a facility that does not support the course sport', async () => {
    const err = await createError(body({ facilityId: TENNIS_COURT.id }));
    expect(err.errors?.[0]?.path).toBe('body.facilityId');
  });

  it('lists classes with their pending registrations and session count', async () => {
    const created = await classAdminService.create(
      body({ name: 'Lớp C', weeklySchedule: [slot(4, '09:00', '10:00')] }),
    );
    const item = (await classAdminService.list()).find((entry) => entry.id === created.id)!;

    expect(item.pendingRegistrations).toBe(0);
    expect(item.sessionCount).toBe(BADMINTON_COURSE.totalSessions);
  });
});

describe('createCourseBodySchema', () => {
  it('still requires a uuid sport id (shared with the API)', () => {
    const parsed = createCourseBodySchema.safeParse({
      name: 'Cầu lông phong trào',
      sportId: 'sport-badminton',
      totalSessions: 10,
      price: 1_500_000,
    });
    expect(parsed.success).toBe(false);
  });
});

function slot(dayOfWeek: number, startTime: string, endTime: string) {
  return { dayOfWeek, startTime, endTime };
}
