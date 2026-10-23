import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

const person = { select: { id: true, fullName: true } } as const;

const announcementSelect = {
  id: true,
  kind: true,
  title: true,
  body: true,
  sender: person,
  createdAt: true,
} satisfies Prisma.ClassAnnouncementSelect;

const classSelect = {
  id: true,
  coachId: true,
  status: true,
  endDate: true,
  deletedAt: true,
  sessions: {
    select: { id: true, sessionNumber: true, sessionDate: true, startTime: true, endTime: true, status: true },
    orderBy: { sessionNumber: 'asc' },
  },
} satisfies Prisma.ClassSelect;

const studentSelect = {
  enrolledAt: true,
  account: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      dateOfBirth: true,
      gender: true,
      memberProfile: { select: { fitnessGoals: true, healthNotes: true, emergencyContact: true } },
    },
  },
} satisfies Prisma.ClassEnrollmentSelect;

const planSelect = {
  id: true,
  accountId: true,
  account: person,
  goals: true,
  content: true,
  updatedBy: person,
  updatedAt: true,
} satisfies Prisma.TrainingPlanSelect;

const reviewSelect = {
  id: true,
  accountId: true,
  account: person,
  milestone: true,
  technique: true,
  fitness: true,
  attitude: true,
  comment: true,
  coach: person,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProgressReviewSelect;

export type AnnouncementRow = Prisma.ClassAnnouncementGetPayload<{ select: typeof announcementSelect }>;
export type TrainingClassRow = Prisma.ClassGetPayload<{ select: typeof classSelect }>;
export type StudentRow = Prisma.ClassEnrollmentGetPayload<{ select: typeof studentSelect }>;
export type PlanRow = Prisma.TrainingPlanGetPayload<{ select: typeof planSelect }>;
export type ReviewRow = Prisma.ProgressReviewGetPayload<{ select: typeof reviewSelect }>;

class ClassTrainingRepository {
  createAnnouncement = (data: Prisma.ClassAnnouncementUncheckedCreateInput, tx: Prisma.TransactionClient) =>
    tx.classAnnouncement.create({ data, select: announcementSelect });

  findAnnouncements = (classId: string) =>
    prisma.classAnnouncement.findMany({
      where: { classId },
      select: announcementSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

  findClass = (id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.class.findFirst({ where: { id, deletedAt: null }, select: classSelect });

  findStudents = (classId: string, accountId?: string) =>
    prisma.classEnrollment.findMany({
      where: { classId, status: 'ENROLLED', accountId },
      select: studentSelect,
      orderBy: [{ account: { fullName: 'asc' } }, { accountId: 'asc' }],
    });

  findAttendances = (classId: string) =>
    prisma.classAttendance.findMany({
      where: { session: { classId, status: 'SCHEDULED' } },
      select: { sessionId: true, accountId: true, status: true },
    });

  findResults = (classId: string) =>
    prisma.memberEvaluation.findMany({
      where: { deletedAt: null, session: { classId } },
      select: { accountId: true, rating: true, session: { select: { sessionNumber: true } } },
    });

  findPlans = (classId: string, accountId?: string | null) =>
    prisma.trainingPlan.findMany({
      where: { classId, ...(accountId !== undefined && { accountId }) },
      select: planSelect,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });

  findReviews = (classId: string, accountId?: string) =>
    prisma.progressReview.findMany({
      where: { classId, accountId },
      select: reviewSelect,
      orderBy: [{ milestone: 'asc' }, { id: 'asc' }],
    });
}

export default new ClassTrainingRepository();
