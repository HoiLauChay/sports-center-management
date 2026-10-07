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

import { createCourseBodySchema, type Facility, type SystemSettings } from '@sports-center/shared';
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

import { classesDb } from '../src/features/classes/mocks/classes';
import { classAdminService } from '../src/features/classes/services/classAdmin.service';
import { coursesService } from '../src/features/courses/services/courses.service';

const mockCourses = [
  {
    id: 'course-badminton-basic',
    name: 'Cầu lông cơ bản',
    description: 'Kỹ thuật nền tảng',
    sport: { id: 'sport-badminton', name: 'Cầu lông' },
    totalSessions: 8,
    price: 1200000,
    thumbnailUrl: null,
  },
  {
    id: 'course-tennis-basic',
    name: 'Tennis cơ bản',
    description: 'Kỹ thuật giao bóng',
    sport: { id: 'sport-tennis', name: 'Tennis' },
    totalSessions: 10,
    price: 2000000,
    thumbnailUrl: null,
  },
];

spyOn(coursesService, 'list').mockResolvedValue(mockCourses);

describe('Issue #168: Manager Courses & Classes', () => {
  describe('classAdminService: acceptance criteria - Lỗi trùng lịch hiển thị buổi bị trùng', () => {
    it('can list all classes for manager regardless of status', async () => {
      const list = await classAdminService.listAll();
      expect(list.length).toBeGreaterThan(0);
      const statuses = new Set(list.map((c) => c.status));
      expect(statuses.has('OPEN') || statuses.has('DRAFT')).toBe(true);
    });

    it('detects schedule conflict when facility is already booked at that slot', async () => {
      const existingClasses = await classAdminService.listAll();
      const existing = existingClasses[0]!;
      const sessions = classesDb.sessionsOf(existing.id);
      const existingSession = sessions[0]!;

      // Ensure course is in mockCourses
      if (!mockCourses.some((c) => c.id === existing.course.id)) {
        mockCourses.push({
          id: existing.course.id,
          name: existing.course.name,
          description: existing.course.description,
          sport: existing.course.sport,
          totalSessions: existing.course.totalSessions,
          price: existing.course.price,
          thumbnailUrl: null,
        });
      }

      const dateObj = new Date(existingSession.date);
      const dayOfWeek = dateObj.getDay();

      try {
        await classAdminService.create({
          courseId: existing.course.id,
          name: 'Lớp mới kiểm tra trùng lịch',
          facilityId: existingSession.facility.id,
          startDate: existingSession.date,
          weeklySchedule: [
            {
              dayOfWeek,
              startTime: existingSession.startTime,
              endTime: existingSession.endTime,
            },
          ],
          minStudents: 4,
          maxStudents: 10,
        });
        // Should have thrown
        expect(false).toBe(true);
      } catch (err: unknown) {
        const errorObj = err as { code?: string; conflicts?: unknown[] };
        expect(errorObj.code).toBe('SCHEDULE_CONFLICT');
        expect(Array.isArray(errorObj.conflicts)).toBe(true);
        expect(errorObj.conflicts!.length).toBeGreaterThan(0);

        const firstConflict = errorObj.conflicts![0] as {
          date: string;
          startTime: string;
          endTime: string;
          classSession: { className: string };
        };
        expect(firstConflict.date).toBe(existingSession.date);
        expect(firstConflict.classSession.className).toBe(existing.name);
      }
    });

    it('successfully creates class when no schedule conflict exists', async () => {
      const created = await classAdminService.create({
        courseId: 'course-badminton-basic',
        name: 'Lớp Cầu Lông Sáng Thứ Bảy',
        facilityId: 'fac-1',
        startDate: '2026-12-05',
        weeklySchedule: [
          {
            dayOfWeek: 6, // Saturday
            startTime: '10:00',
            endTime: '11:30',
          },
        ],
        minStudents: 4,
        maxStudents: 12,
      });

      expect(created.id).toBeDefined();
      expect(created.status).toBe('DRAFT');
      expect(created.maxStudents).toBe(12);
      expect(classesDb.sessionsOf(created.id).length).toBe(8);
    });
  });

  describe('createCourseBodySchema validation', () => {
    it('successfully validates course with string sportId like sport-badminton', () => {
      const validPayload = {
        name: 'Cầu lông phong trào',
        description: 'Khóa học cơ bản',
        sportId: 'sport-badminton',
        totalSessions: 10,
        price: 1500000,
        thumbnailUrl: null,
      };

      const parsed = createCourseBodySchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
    });

    it('rejects empty sportId', () => {
      const invalidPayload = {
        name: 'Cầu lông phong trào',
        sportId: '',
        totalSessions: 10,
        price: 1500000,
      };

      const parsed = createCourseBodySchema.safeParse(invalidPayload);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const sportError = parsed.error.issues.find((i) => i.path.includes('sportId'));
        expect(sportError?.message).toBe('Mã bộ môn không hợp lệ');
      }
    });
  });
});
