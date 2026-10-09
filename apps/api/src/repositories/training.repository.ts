import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

const ref = { select: { id: true, name: true } } as const;
const person = { select: { id: true, fullName: true } } as const;

const sessionSelect = {
  id: true,
  classId: true,
  sessionNumber: true,
  sessionDate: true,
  startTime: true,
  endTime: true,
  facility: ref,
  status: true,
  cancelReason: true,
} satisfies Prisma.ClassSessionSelect;

const noteSessionSelect = {
  ...sessionSelect,
  noteTitle: true,
  noteContent: true,
  noteAttachments: true,
  noteUpdatedAt: true,
  class: { select: { coachId: true, status: true, deletedAt: true } },
} satisfies Prisma.ClassSessionSelect;

const evaluationSelect = {
  id: true,
  sessionId: true,
  accountId: true,
  coachId: true,
  rating: true,
  comment: true,
  deletedAt: true,
  createdAt: true,
  session: { select: sessionSelect },
  account: person,
  coach: person,
} satisfies Prisma.MemberEvaluationSelect;

export type TrainingSessionRow = Prisma.ClassSessionGetPayload<{ select: typeof noteSessionSelect }>;
export type EvaluationRow = Prisma.MemberEvaluationGetPayload<{ select: typeof evaluationSelect }>;

const byNewest = [{ createdAt: 'desc' }, { id: 'desc' }] satisfies Prisma.MemberEvaluationOrderByWithRelationInput[];

class TrainingRepository {
  findSession = (id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.classSession.findUnique({ where: { id }, select: noteSessionSelect });

  saveNote = (id: string, data: Prisma.ClassSessionUncheckedUpdateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.classSession.update({ where: { id }, data, select: noteSessionSelect });

  findEvaluation = (id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.memberEvaluation.findFirst({ where: { id, deletedAt: null }, select: evaluationSelect });

  hasEvaluation = async (sessionId: string, accountId: string, tx: Prisma.TransactionClient = prisma) =>
    (await tx.memberEvaluation.count({ where: { sessionId, accountId, deletedAt: null } })) > 0;

  findSessionEvaluations = (sessionId: string) =>
    prisma.memberEvaluation.findMany({
      where: { sessionId, deletedAt: null },
      select: evaluationSelect,
      orderBy: byNewest,
    });

  findMemberEvaluations = (accountId: string, classId?: string) =>
    prisma.memberEvaluation.findMany({
      where: { accountId, deletedAt: null, session: { classId } },
      select: evaluationSelect,
      orderBy: byNewest,
    });

  createEvaluation = (data: Prisma.MemberEvaluationUncheckedCreateInput, tx: Prisma.TransactionClient) =>
    tx.memberEvaluation.create({ data, select: evaluationSelect });

  updateEvaluation = (id: string, data: Prisma.MemberEvaluationUncheckedUpdateInput, tx: Prisma.TransactionClient) =>
    tx.memberEvaluation.update({ where: { id }, data, select: evaluationSelect });
}

export default new TrainingRepository();
