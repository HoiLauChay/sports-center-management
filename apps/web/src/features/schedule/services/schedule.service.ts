import type { Account } from '@sports-center/shared';
import { loadCatalog } from '~/features/checkout/mocks/pricing';
import { claimClassesForCoach } from '~/features/classes/mocks/classAdmin';
import { ensureClassSeed } from '~/features/classes/mocks/classes';
import { mockRequest } from '~/lib/mock/errors';
import { coachSchedule, mySchedule, sessionsOn } from '../mocks/schedule';
import type { ScheduleRange } from '../types';

async function seeded() {
  const { facilities, settings } = await loadCatalog();
  ensureClassSeed(facilities, settings);
}

/**
 * My schedule (`GET /me/schedule`) and a coach's teaching schedule (`GET /coach/schedule`). Mock until #166 ships;
 * the shapes follow `api.design.md`, so each body becomes a `privateApi.get` with `from` / `to`.
 */
export const scheduleService = {
  mine: (user: Account, range: ScheduleRange) =>
    mockRequest(async () => {
      await seeded();
      return mySchedule(user.id, range);
    }, 180),

  coach: (user: Account, range: ScheduleRange) =>
    mockRequest(async () => {
      await seeded();
      const coach = { id: user.id, fullName: user.fullName };
      claimClassesForCoach(coach);
      return coachSchedule(coach, range);
    }, 180),

  /** Class sessions of one day for the dashboards (the real API will derive it from the class list). */
  sessionsOn: (date: string) =>
    mockRequest(async () => {
      await seeded();
      return sessionsOn(date);
    }, 150),
};
