import type { Account, CreateClassBody } from '@sports-center/shared';
import { loadCatalog } from '~/features/checkout/mocks/pricing';
import { actorOf } from '~/features/checkout/services/checkout.service';
import { coursesService } from '~/features/courses/services/courses.service';
import { walletService } from '~/features/wallet/services/wallet.service';
import { mockRequest } from '~/lib/mock/errors';
import {
  approveClass,
  assignCoach,
  cancelClass,
  classOverview,
  classRefundPreview,
  coachPool,
  createClass,
  getAdminDetail,
  listClassesForManager,
  rejectClass,
  updateClass,
  updateSession,
} from '../mocks/classAdmin';
import { ensureClassSeed } from '../mocks/classes';
import type { ClassPatch, SessionPatch } from '../types';

export type { ManagerClassItem } from '../mocks/classAdmin';

async function seeded() {
  const catalog = await loadCatalog();
  ensureClassSeed(catalog.facilities, catalog.settings);
  return catalog;
}

/**
 * Manager class management (`GET /classes/{id}`, `PATCH /classes/{id}`, approve / reject / cancel, `assign-coach`,
 * `PATCH /sessions/{id}`). Mock until #171 ships, since the page also needs coach registrations and enrollments; the shapes follow
 * `api.design.md`, so each body becomes a `privateApi` call.
 */
export const classAdminService = {
  list: () =>
    mockRequest(async () => {
      await seeded();
      return listClassesForManager();
    }, 150),

  create: (input: CreateClassBody) =>
    mockRequest(async () => {
      const { facilities } = await seeded();
      const courses = await coursesService.list();
      return createClass(input, facilities, courses);
    }, 300),

  get: (id: string) =>
    mockRequest(async () => {
      await seeded();
      return getAdminDetail(id);
    }, 150),

  overview: () =>
    mockRequest(async () => {
      await seeded();
      return classOverview();
    }, 150),

  coaches: () =>
    mockRequest(async () => {
      await seeded();
      return coachPool();
    }, 100),

  update: (id: string, patch: ClassPatch) =>
    mockRequest(async () => {
      await seeded();
      return updateClass(id, patch);
    }, 250),

  approve: (id: string) =>
    mockRequest(async () => {
      await seeded();
      return approveClass(id);
    }, 250),

  reject: (id: string) =>
    mockRequest(async () => {
      await seeded();
      return rejectClass(id);
    }, 250),

  assignCoach: (id: string, input: { registrationId: string } | { coachId: string }) =>
    mockRequest(async () => {
      await seeded();
      return assignCoach(id, input);
    }, 250),

  classRefundPreview: (id: string) =>
    mockRequest(async () => {
      await seeded();
      return classRefundPreview(id);
    }, 100),

  cancel: (user: Account, id: string, reason: string) =>
    mockRequest(async () => {
      await seeded();
      return cancelClass(actorOf(user), id, reason, walletService.balanceOfMember);
    }, 400),

  updateSession: (sessionId: string, patch: SessionPatch) =>
    mockRequest(async () => {
      const { facilities } = await seeded();
      return updateSession(sessionId, patch, facilities);
    }, 250),
};
