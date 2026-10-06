import type { Account } from '@sports-center/shared';
import { loadCatalog } from '~/features/checkout/mocks/pricing';
import { actorOf } from '~/features/checkout/services/checkout.service';
import { walletService } from '~/features/wallet/services/wallet.service';
import { mockRequest } from '~/lib/mock/errors';
import {
  approveClass,
  assignCoach,
  cancelClass,
  cancelSession,
  classOverview,
  classRefundPreview,
  coachPool,
  getAdminDetail,
  rejectClass,
  sessionRefundPreview,
  setMinStudentsOverride,
  updateClass,
  updateSession,
} from '../mocks/classAdmin';
import { ensureClassSeed } from '../mocks/classes';
import type { ClassPatch, SessionPatch } from '../types';

async function seeded() {
  const catalog = await loadCatalog();
  ensureClassSeed(catalog.facilities, catalog.settings);
  return catalog;
}

/**
 * Manager class management (`GET /classes/{id}`, `PATCH /classes/{id}`, approve / reject / cancel, `assign-coach`,
 * `PATCH /sessions/{id}`, `POST /sessions/{id}/cancel`). Mock until #164 and #171 ship; the shapes follow
 * `api.design.md`, so each body becomes a `privateApi` call.
 */
export const classAdminService = {
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

  setMinStudentsOverride: (id: string, override: boolean) =>
    mockRequest(async () => {
      await seeded();
      return setMinStudentsOverride(id, override);
    }, 200),

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

  sessionRefundPreview: (sessionId: string) =>
    mockRequest(async () => {
      await seeded();
      return sessionRefundPreview(sessionId);
    }, 100),

  cancelSession: (user: Account, sessionId: string, reason: string) =>
    mockRequest(async () => {
      await seeded();
      return cancelSession(actorOf(user), sessionId, reason, walletService.balanceOfMember);
    }, 400),
};
