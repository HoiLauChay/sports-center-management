import type { ApiResponse, Person, Specialization } from '@sports-center/shared';
import { loadCatalog } from '~/features/checkout/mocks/pricing';
import { privateApi } from '~/lib/http';
import { mockRequest } from '~/lib/mock/errors';
import {
  getClassStudents,
  getClassesTaughtByCoach,
  getOpenClassesForCoach,
  registerCoachForClass,
  withdrawCoachRegistration,
} from '../mocks/classAdmin';
import { ensureClassSeed } from '../mocks/classes';

export type { CoachClassItem, OpenClassItem } from '../mocks/classAdmin';

async function seeded() {
  const catalog = await loadCatalog();
  ensureClassSeed(catalog.facilities, catalog.settings);
}

/** Sport ids the coach may teach: their APPROVED specializations (BR_2.14). */
const approvedSportIds = async () =>
  (await coachClassesService.approvedSpecializations()).map((specialization) => specialization.sport.id);

/**
 * Coach-side class pages. Specializations come from the real `GET /coach/specializations`; the class lists and
 * registrations stay mock until #171 ships the class API.
 */
export const coachClassesService = {
  approvedSpecializations: async (): Promise<Specialization[]> => {
    const { data } = await privateApi.get<ApiResponse<Specialization[]>>('/coach/specializations');
    return data.result.filter((specialization) => specialization.status === 'APPROVED');
  },

  listOpenClasses: async (coach: Person) => {
    const sportIds = await approvedSportIds();
    return mockRequest(async () => {
      await seeded();
      return getOpenClassesForCoach(coach.id, sportIds);
    }, 150);
  },

  registerToTeach: async (coach: Person, classId: string) => {
    const sportIds = await approvedSportIds();
    return mockRequest(async () => {
      await seeded();
      return registerCoachForClass(classId, { id: coach.id, fullName: coach.fullName }, sportIds);
    }, 300);
  },

  withdraw: (coach: Person, classId: string) =>
    mockRequest(async () => {
      await seeded();
      return withdrawCoachRegistration(classId, coach.id);
    }, 250),

  listMyClasses: (coach: Person) =>
    mockRequest(async () => {
      await seeded();
      return getClassesTaughtByCoach(coach.id);
    }, 150),

  classStudents: (classId: string) =>
    mockRequest(async () => {
      await seeded();
      return getClassStudents(classId);
    }, 150),
};
