import type { Facility, SystemSettings } from '@sports-center/shared';
import { describe, expect, it, spyOn } from 'bun:test';
import * as pricing from '../src/features/checkout/mocks/pricing';

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

spyOn(pricing, 'loadCatalog').mockResolvedValue({
  facilities: [
    {
      id: 'fac-1',
      name: 'Sân cầu lông 1',
      isActive: true,
      sports: [{ id: 'sport-badminton', name: 'Cầu lông' }],
      slotCapacity: 1,
    } as unknown as Facility,
    {
      id: 'fac-2',
      name: 'Sân tennis 1',
      isActive: true,
      sports: [{ id: 'sport-tennis', name: 'Tennis' }],
      slotCapacity: 1,
    } as unknown as Facility,
  ],
  settings: {
    openTime: '06:00',
    closeTime: '22:00',
    slotDurationMinutes: 60,
  } as unknown as SystemSettings,
  packages: [],
});

import { classesDb } from '../src/features/classes/mocks/classes';
import { classesService } from '../src/features/classes/services/classes.service';
import type { GymClass } from '../src/features/classes/types';

describe('Issue #172: Member Classes & Acceptance Criteria', () => {
  const dummyClass: GymClass = {
    id: 'class-test-1',
    name: 'Cầu lông nâng cao',
    course: {
      id: 'course-1',
      name: 'Cầu lông nâng cao',
      description: 'Lớp nâng cao kỹ thuật',
      sport: { id: 'sport-badminton', name: 'Cầu lông' },
      totalSessions: 8,
      price: 1500000,
      thumbnailUrl: null,
    },
    status: 'OPEN',
    derivedStatus: 'UPCOMING',
    startDate: '2026-10-20',
    endDate: '2026-11-20',
    weeklySchedule: [{ dayOfWeek: 1, startTime: '08:00', endTime: '09:30' }],
    facility: { id: 'fac-1', name: 'Sân cầu lông 1' },
    coach: { id: 'coach-1', fullName: 'Nguyễn Văn Minh' },
    minStudents: 4,
    maxStudents: 10,
    enrolledCount: 3,
    cancelReason: null,
  };

  describe('Acceptance criteria: Lớp đã bắt đầu không có trong danh sách', () => {
    it('chấp nhận lớp OPEN, chưa bắt đầu (derivedStatus = UPCOMING)', () => {
      expect(classesDb.enrollable(dummyClass)).toBe(true);
    });

    it('loại bỏ lớp đã bắt đầu (derivedStatus = ONGOING)', () => {
      const ongoingClass: GymClass = {
        ...dummyClass,
        derivedStatus: 'ONGOING',
      };
      expect(classesDb.enrollable(ongoingClass)).toBe(false);
    });

    it('loại bỏ lớp đã kết thúc (derivedStatus = COMPLETED)', () => {
      const completedClass: GymClass = {
        ...dummyClass,
        derivedStatus: 'COMPLETED',
      };
      expect(classesDb.enrollable(completedClass)).toBe(false);
    });

    it('loại bỏ lớp đã đầy học viên (enrolledCount >= maxStudents)', () => {
      const fullClass: GymClass = {
        ...dummyClass,
        enrolledCount: 10,
        maxStudents: 10,
      };
      expect(classesDb.enrollable(fullClass)).toBe(false);
    });

    it('loại bỏ lớp chưa có HLV (coach = null)', () => {
      const noCoachClass: GymClass = {
        ...dummyClass,
        coach: null,
      };
      expect(classesDb.enrollable(noCoachClass)).toBe(false);
    });
  });

  describe('classesService.list', () => {
    it('chỉ trả về các lớp OPEN và chưa bắt đầu', async () => {
      const res = await classesService.list({ page: 1, limit: 20 });
      expect(res.items.length).toBeGreaterThan(0);
      for (const item of res.items) {
        expect(item.status).toBe('OPEN');
        expect(item.derivedStatus).toBe('UPCOMING');
        expect(item.coach).not.toBeNull();
        expect(item.enrolledCount).toBeLessThan(item.maxStudents);
      }
    });

    it('lọc chính xác theo sportId', async () => {
      const all = await classesService.list({ page: 1, limit: 20 });
      const targetSportId = all.items[0]?.course.sport.id;
      if (targetSportId) {
        const filtered = await classesService.list({ page: 1, limit: 20, sportId: targetSportId });
        for (const item of filtered.items) {
          expect(item.course.sport.id).toBe(targetSportId);
        }
      }
    });

    it('lọc chính xác theo coachId', async () => {
      const all = await classesService.list({ page: 1, limit: 20 });
      const targetCoachId = all.items[0]?.coach?.id;
      if (targetCoachId) {
        const filtered = await classesService.list({ page: 1, limit: 20, coachId: targetCoachId });
        for (const item of filtered.items) {
          expect(item.coach?.id).toBe(targetCoachId);
        }
      }
    });

    it('tìm kiếm theo từ khóa (q)', async () => {
      const all = await classesService.list({ page: 1, limit: 20 });
      const first = all.items[0];
      if (first) {
        const searchTerm = first.name.slice(0, 5);
        const filtered = await classesService.list({ page: 1, limit: 20, q: searchTerm });
        expect(filtered.items.length).toBeGreaterThan(0);
      }
    });
  });
});
