import { prisma } from '~/configs/db';
import type { Prisma, ProgressMilestone } from '~/generated/prisma/client';

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
  classId: true,
  accountId: true,
  coachId: true,
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

  findPlanContext = (id: string) =>
    prisma.class.findFirst({
      where: { id, deletedAt: null },
      select: {
        name: true,
        weeklySchedule: true,
        course: { select: { name: true, description: true, totalSessions: true, sport: { select: { name: true } } } },
      },
    });

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

  findResults = (classId: string, accountId?: string) =>
    prisma.memberEvaluation.findMany({
      where: { deletedAt: null, session: { classId }, accountId },
      select: { accountId: true, rating: true, comment: true, session: { select: { sessionNumber: true } } },
    });

  findPlans = (classId: string, accountId?: string | null) =>
    prisma.trainingPlan.findMany({
      where: { classId, ...(accountId !== undefined && { accountId }) },
      select: planSelect,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });

  savePlan = async (
    classId: string,
    accountId: string | null,
    data: { goals: string; content: string; updatedById: string },
    tx: Prisma.TransactionClient,
  ) => {
    const current = await tx.trainingPlan.findFirst({ where: { classId, accountId }, select: { id: true } });
    return current
      ? tx.trainingPlan.update({ where: { id: current.id }, data, select: planSelect })
      : tx.trainingPlan.create({ data: { classId, accountId, ...data }, select: planSelect });
  };

  findReview = (classId: string, accountId: string, milestone: ProgressMilestone, tx: Prisma.TransactionClient) =>
    tx.progressReview.findUnique({
      where: { classId_accountId_milestone: { classId, accountId, milestone } },
      select: reviewSelect,
    });

  saveReview = (
    key: { classId: string; accountId: string; milestone: ProgressMilestone },
    data: { technique: number; fitness: number; attitude: number; comment: string; coachId: string },
    tx: Prisma.TransactionClient,
  ) =>
    tx.progressReview.upsert({
      where: { classId_accountId_milestone: key },
      create: { ...key, ...data },
      update: data,
      select: reviewSelect,
    });

  findReviews = (classId: string, accountId?: string) =>
    prisma.progressReview.findMany({
      where: { classId, accountId },
      select: reviewSelect,
      orderBy: [{ milestone: 'asc' }, { id: 'asc' }],
    });
}

export default new ClassTrainingRepository();
