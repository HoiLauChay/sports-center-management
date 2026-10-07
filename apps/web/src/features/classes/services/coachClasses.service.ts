import type { ApiResponse, Specialization } from '@sports-center/shared';
import { authService } from '~/features/auth/services/auth.service';
import { loadCatalog } from '~/features/checkout/mocks/pricing';
import { privateApi } from '~/lib/http';
import { mockRequest } from '~/lib/mock/errors';
import {
  getClassStudents,
  getClassesTaughtByCoach,
  getOpenClassesForCoach,
  registerCoachForClass,
} from '../mocks/classAdmin';
import { ensureClassSeed } from '../mocks/classes';
import type { ClassStudent, GymClass } from '../types';

export interface OpenClassItem extends GymClass {
  hasApplied: boolean;
  registrationStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export const coachClassesService = {
  getApprovedSpecializations: async (): Promise<Specialization[]> => {
    try {
      const { data } = await privateApi.get<ApiResponse<Specialization[]>>('/specializations');
      return (data.result ?? []).filter((s) => s.status === 'APPROVED');
    } catch {
      return [
        {
          id: 'spec-1',
          coach: { id: 'mock-coach-minh', fullName: 'Nguyễn Văn Minh' },
          sport: { id: 'sport-badminton', name: 'Cầu lông' },
          status: 'APPROVED',
          reviewNote: null,
          reviewedAt: '2026-01-01T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'spec-2',
          coach: { id: 'mock-coach-minh', fullName: 'Nguyễn Văn Minh' },
          sport: { id: 'sport-swimming', name: 'Bơi lội' },
          status: 'APPROVED',
          reviewNote: null,
          reviewedAt: '2026-01-01T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ];
    }
  },

  listOpenClasses: async (): Promise<OpenClassItem[]> => {
    const catalog = await loadCatalog();
    ensureClassSeed(catalog.facilities, catalog.settings);

    let me;
    try {
      me = await authService.me();
    } catch {
      me = { id: 'mock-coach-minh', fullName: 'Nguyễn Văn Minh' };
    }

    const specializations = await coachClassesService.getApprovedSpecializations();
    const approvedSportIds = specializations.map((s) => s.sport.id);

    return mockRequest(() => getOpenClassesForCoach(me.id, approvedSportIds), 150);
  },

  registerToTeach: async (classId: string) => {
    let me;
    try {
      me = await authService.me();
    } catch {
      me = { id: 'mock-coach-minh', fullName: 'Nguyễn Văn Minh' };
    }

    const specializations = await coachClassesService.getApprovedSpecializations();
    const approvedSportIds = specializations.map((s) => s.sport.id);

    return mockRequest(
      () => registerCoachForClass(classId, { id: me.id, fullName: me.fullName }, approvedSportIds),
      300,
    );
  },

  listMyClasses: async (): Promise<GymClass[]> => {
    const catalog = await loadCatalog();
    ensureClassSeed(catalog.facilities, catalog.settings);

    let me;
    try {
      me = await authService.me();
    } catch {
      me = { id: 'mock-coach-minh', fullName: 'Nguyễn Văn Minh' };
    }

    return mockRequest(() => getClassesTaughtByCoach(me.id), 150);
  },

  getClassStudents: async (classId: string): Promise<ClassStudent[]> => {
    return mockRequest(() => getClassStudents(classId), 150);
  },
};
