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

import type { Facility, SystemSettings } from '@sports-center/shared';
import * as pricing from '../src/features/checkout/mocks/pricing';

const mockFacilities: Facility[] = [
  {
    id: 'fac-1',
    name: 'Sân cầu lông 1',
    isActive: true,
    sports: [{ id: 'sport-badminton', name: 'Cầu lông' }],
    slotCapacity: 1,
  } as unknown as Facility,
  {
    id: 'fac-2',
    name: 'Hồ bơi trung tâm',
    isActive: true,
    sports: [{ id: 'sport-swimming', name: 'Bơi lội' }],
    slotCapacity: 1,
  } as unknown as Facility,
  {
    id: 'fac-3',
    name: 'Sân tennis 1',
    isActive: true,
    sports: [{ id: 'sport-tennis', name: 'Tennis' }],
    slotCapacity: 1,
  } as unknown as Facility,
];

spyOn(pricing, 'loadCatalog').mockResolvedValue({
  facilities: mockFacilities,
  settings: {
    openTime: '06:00',
    closeTime: '22:00',
    slotDurationMinutes: 60,
  } as unknown as SystemSettings,
  packages: [],
});

import { authService } from '../src/features/auth/services/auth.service';
import { classesDb, classesStore } from '../src/features/classes/mocks/classes';
import { coachClassesService } from '../src/features/classes/services/coachClasses.service';
import { MockApiError } from '../src/lib/mock/errors';

import type { Account } from '@sports-center/shared';

const mockCoach = {
  id: 'mock-coach-minh',
  fullName: 'Nguyễn Văn Minh',
  role: 'COACH',
  status: 'ACTIVE',
};

spyOn(authService, 'me').mockResolvedValue(mockCoach as unknown as Account);

describe('Issue #174: Coach Classes & Open Classes', () => {
  describe('Acceptance Criteria: Chỉ hiện lớp thuộc bộ môn đã duyệt', () => {
    it('open-classes only includes classes whose sport is in approved specializations', async () => {
      // Coach Minh has approved specializations: Cầu lông (sport-badminton) and Bơi lội (sport-swimming)
      const approvedSpecs = await coachClassesService.getApprovedSpecializations();
      expect(approvedSpecs.length).toBeGreaterThan(0);
      const approvedSportIds = approvedSpecs.map((s) => s.sport.id);
      expect(approvedSportIds).toContain('sport-badminton');

      const openClasses = await coachClassesService.listOpenClasses();
      expect(openClasses.length).toBeGreaterThan(0);

      // Every single class must belong to an approved sport
      for (const item of openClasses) {
        expect(approvedSportIds).toContain(item.course.sport.id);
        // Should not have tennis or other non-approved sports
        expect(item.course.sport.id).not.toBe('sport-tennis');
      }
    });

    it('rejects registration for a class outside approved specializations', async () => {
      // Find or seed a class with non-approved sport (tennis)
      const all = classesDb.allClasses();
      const tennisClass = all.find((c) => c.course.sport.id === 'sport-tennis');

      if (tennisClass) {
        try {
          await coachClassesService.registerToTeach(tennisClass.id);
          expect(false).toBe(true);
        } catch (err: unknown) {
          expect(err instanceof MockApiError).toBe(true);
          const mockErr = err as MockApiError;
          expect(mockErr.code).toBe('FORBIDDEN_SPORT');
        }
      }
    });
  });

  describe('Coach registration & clash detection', () => {
    it('allows coach to register to teach an open class in approved sport', async () => {
      const openClasses = await coachClassesService.listOpenClasses();
      const target = openClasses.find((c) => !c.hasApplied && c.coach === null);
      if (!target) return;

      const res = await coachClassesService.registerToTeach(target.id);
      expect(res.success).toBe(true);

      // Subsequent list should show hasApplied = true
      const updatedList = await coachClassesService.listOpenClasses();
      const updatedItem = updatedList.find((c) => c.id === target.id);
      expect(updatedItem?.hasApplied).toBe(true);
      expect(updatedItem?.registrationStatus).toBe('PENDING');
    });

    it('prevents registering twice for the same class', async () => {
      const openClasses = await coachClassesService.listOpenClasses();
      const target = openClasses.find((c) => c.hasApplied);
      if (!target) return;

      try {
        await coachClassesService.registerToTeach(target.id);
        expect(false).toBe(true);
      } catch (err: unknown) {
        expect(err instanceof MockApiError).toBe(true);
        const mockErr = err as MockApiError;
        expect(mockErr.code).toBe('ALREADY_REGISTERED');
      }
    });
  });

  describe('UC_2.21: Xem danh sách học viên', () => {
    it('returns classes taught by this coach', async () => {
      const myClasses = await coachClassesService.listMyClasses();
      // If none assigned yet, assign mockCoach to one class
      if (myClasses.length === 0) {
        const first = classesDb.allClasses()[0]!;
        classesStore.update((state) => {
          const stored = state.classes.find((c) => c.id === first.id);
          if (stored) {
            stored.coach = { id: mockCoach.id, fullName: mockCoach.fullName };
          }
        });
      }

      const refreshed = await coachClassesService.listMyClasses();
      expect(refreshed.length).toBeGreaterThan(0);
      expect(refreshed.every((c) => c.coach?.id === mockCoach.id)).toBe(true);
    });

    it('returns roster of students for a class (UC_2.21)', async () => {
      const myClasses = await coachClassesService.listMyClasses();
      expect(myClasses.length).toBeGreaterThan(0);
      const target = myClasses[0]!;

      const students = await coachClassesService.getClassStudents(target.id);
      expect(Array.isArray(students)).toBe(true);
      if (students.length > 0) {
        expect(students[0]!.fullName).toBeDefined();
        expect(students[0]!.status).toBe('ENROLLED');
      }
    });
  });
});
