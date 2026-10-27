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
  TrainingPlanSuggestion,
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

  /** An AI draft for the class plan, or for one student's plan when accountId is given; nothing is saved. */
  suggestPlan: async (classId: string, accountId: string | null) => {
    const url = `${accountId ? student(classId, accountId) : cls(classId)}/plan/suggestion`;
    // The AI takes far longer than the default 15s to write a plan.
    const { data } = await privateApi.post<ApiResponse<TrainingPlanSuggestion>>(url, undefined, {
      timeout: 120_000,
    });
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
