import type { ClassAnnouncement, ProgressReview, TrainingPlan } from '@sports-center/shared';

import type { AnnouncementRow, PlanRow, ReviewRow } from '~/repositories/classTraining.repository';

export const toAnnouncementResponse = (row: AnnouncementRow): ClassAnnouncement => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  body: row.body,
  sender: row.sender,
  createdAt: row.createdAt.toISOString(),
});

export const toTrainingPlanResponse = (row: PlanRow): TrainingPlan => ({
  account: row.account,
  goals: row.goals,
  content: row.content,
  updatedBy: row.updatedBy,
  updatedAt: row.updatedAt.toISOString(),
});

export const toProgressReviewResponse = (row: ReviewRow): ProgressReview => ({
  account: row.account,
  milestone: row.milestone,
  technique: row.technique,
  fitness: row.fitness,
  attitude: row.attitude,
  comment: row.comment,
  coach: row.coach,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});
