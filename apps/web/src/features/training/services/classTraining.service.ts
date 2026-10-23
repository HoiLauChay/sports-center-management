import type {
  ApiResponse,
  ClassAnnouncement,
  ClassPlans,
  MyClassTraining,
  ProgressMilestone,
  ProgressReview,
  RosterEntry,
  SaveProgressReviewBody,
  SaveTrainingPlanBody,
  StudentProgress,
  TrainingPlan,
} from '@sports-center/shared';
import { privateApi } from '~/lib/http';

const cls = (id: string) => `/classes/${encodeURIComponent(id)}`;
const student = (classId: string, accountId: string) => `${cls(classId)}/students/${encodeURIComponent(accountId)}`;

/** A class's students, plans, progress reviews and announcements, for its coach, managers and its students. */
export const classTrainingService = {
  roster: async (classId: string) => {
    const { data } = await privateApi.get<ApiResponse<RosterEntry[]>>(`${cls(classId)}/roster`);
    return data.result;
  },

  student: async (classId: string, accountId: string) => {
    const { data } = await privateApi.get<ApiResponse<StudentProgress>>(student(classId, accountId));
    return data.result;
  },

  plans: async (classId: string) => {
    const { data } = await privateApi.get<ApiResponse<ClassPlans>>(`${cls(classId)}/plans`);
    return data.result;
  },

  saveClassPlan: async (classId: string, body: SaveTrainingPlanBody) => {
    const { data } = await privateApi.put<ApiResponse<TrainingPlan>>(`${cls(classId)}/plan`, body);
    return data.result;
  },

  saveMemberPlan: async (classId: string, accountId: string, body: SaveTrainingPlanBody) => {
    const { data } = await privateApi.put<ApiResponse<TrainingPlan>>(`${student(classId, accountId)}/plan`, body);
    return data.result;
  },

  saveReview: async (
    classId: string,
    accountId: string,
    milestone: ProgressMilestone,
    body: SaveProgressReviewBody,
  ) => {
    const { data } = await privateApi.put<ApiResponse<ProgressReview>>(
      `${student(classId, accountId)}/reviews/${milestone}`,
      body,
    );
    return data.result;
  },

  announcements: async (classId: string) => {
    const { data } = await privateApi.get<ApiResponse<ClassAnnouncement[]>>(`${cls(classId)}/announcements`);
    return data.result;
  },

  myTraining: async (classId: string) => {
    const { data } = await privateApi.get<ApiResponse<MyClassTraining>>(
      `/me/classes/${encodeURIComponent(classId)}/training`,
    );
    return data.result;
  },
};
