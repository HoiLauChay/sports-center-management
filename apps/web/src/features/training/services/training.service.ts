import type { Account } from '@sports-center/shared';
import { loadBenefits, loadCatalog } from '~/features/checkout/mocks/pricing';
import { actorOf } from '~/features/checkout/services/checkout.service';
import { claimClassesForCoach } from '~/features/classes/mocks/classAdmin';
import { ensureClassSeed } from '~/features/classes/mocks/classes';
import { usersService } from '~/features/users/services/users.service';
import { mockErrors, mockRequest } from '~/lib/mock/errors';
import {
  checkInCheck,
  checkInsToday,
  createCheckIn,
  createEvaluation,
  deleteEvaluation,
  getAttendance,
  getNote,
  getTrainingSession,
  listAnnouncements,
  listEvaluations,
  myAttendance,
  myCheckIns,
  myClasses,
  myEvaluations,
  putNote,
  saveAttendance,
  sendAnnouncement,
  updateEvaluation,
} from '../mocks/training';
import type { AttendanceInput, EvaluationInput, SessionNoteInput } from '../types';

async function seeded(user: Account) {
  const { facilities, settings } = await loadCatalog();
  ensureClassSeed(facilities, settings);
  if (user.role === 'COACH') claimClassesForCoach({ id: user.id, fullName: user.fullName });
}

/** Resolves a member to what the check-in rules need: their status and whether their membership gives gym access. */
async function checkOf(user: Account, memberId: string) {
  const account = await usersService.get(memberId);
  if (account.role !== 'MEMBER') throw mockErrors.invalid('accountId', 'Chỉ check-in cho thành viên');
  const person = { id: account.id, fullName: account.fullName };
  const benefits = await loadBenefits(actorOf(user), { kind: 'MEMBER', person });
  return checkInCheck({ ...person, status: account.status, phone: account.phone }, benefits?.gymAccess ?? false);
}

/**
 * Attendance, session notes, evaluations, class announcements, my training history and check-in. Mock until #175,
 * #176 and #177 ship; the shapes follow `api.design.md` (Training), so each body becomes a `privateApi` call.
 */
export const trainingService = {
  session: (user: Account, sessionId: string) =>
    mockRequest(async () => {
      await seeded(user);
      return getTrainingSession(actorOf(user), sessionId);
    }, 150),

  attendance: (user: Account, sessionId: string) =>
    mockRequest(async () => {
      await seeded(user);
      return getAttendance(actorOf(user), sessionId);
    }, 150),

  saveAttendance: (user: Account, sessionId: string, records: AttendanceInput[]) =>
    mockRequest(async () => {
      await seeded(user);
      return saveAttendance(actorOf(user), sessionId, records);
    }, 350),

  note: (user: Account, sessionId: string) =>
    mockRequest(async () => {
      await seeded(user);
      return getNote(actorOf(user), sessionId);
    }, 120),

  saveNote: (user: Account, sessionId: string, input: SessionNoteInput) =>
    mockRequest(async () => {
      await seeded(user);
      return putNote(actorOf(user), sessionId, input);
    }, 300),

  evaluations: (user: Account, sessionId: string) =>
    mockRequest(async () => {
      await seeded(user);
      return listEvaluations(actorOf(user), sessionId);
    }, 150),

  createEvaluation: (user: Account, sessionId: string, input: EvaluationInput) =>
    mockRequest(async () => {
      await seeded(user);
      return createEvaluation(actorOf(user), sessionId, input);
    }, 300),

  updateEvaluation: (user: Account, id: string, patch: { rating?: number; comment?: string }) =>
    mockRequest(async () => {
      await seeded(user);
      return updateEvaluation(actorOf(user), id, patch);
    }, 300),

  deleteEvaluation: (user: Account, id: string) =>
    mockRequest(async () => {
      await seeded(user);
      return deleteEvaluation(actorOf(user), id);
    }, 300),

  announce: (user: Account, classId: string, input: { title: string; body: string }) =>
    mockRequest(async () => {
      await seeded(user);
      return sendAnnouncement(actorOf(user), classId, input);
    }, 350),

  announcements: (user: Account, classId: string) =>
    mockRequest(async () => {
      await seeded(user);
      return listAnnouncements(classId);
    }, 100),

  myClasses: (user: Account) =>
    mockRequest(async () => {
      await seeded(user);
      return myClasses(user.id);
    }, 150),

  myAttendance: (user: Account, classId?: string) =>
    mockRequest(async () => {
      await seeded(user);
      return myAttendance(user.id, classId);
    }, 150),

  myEvaluations: (user: Account, classId?: string) =>
    mockRequest(async () => {
      await seeded(user);
      return myEvaluations(user.id, classId);
    }, 150),

  myCheckIns: (user: Account, range: { from?: string; to?: string }) =>
    mockRequest(() => myCheckIns(user.id, range), 150),

  checkInsToday: () => mockRequest(() => checkInsToday(), 100),

  /** The eligibility the receptionist sees before confirming (the server re-checks on `POST /checkins`). */
  checkInCheck: (user: Account, memberId: string) =>
    mockRequest(async () => {
      await seeded(user);
      return checkOf(user, memberId);
    }, 200),

  checkIn: (user: Account, memberId: string) =>
    mockRequest(async () => {
      await seeded(user);
      return createCheckIn(actorOf(user), await checkOf(user, memberId));
    }, 350),
};
