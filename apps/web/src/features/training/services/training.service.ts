import type {
  AnnouncementResult,
  ApiResponse,
  Attendance,
  CheckIn,
  CreateAnnouncementBody,
  CreateEvaluationBody,
  Evaluation,
  ListMyCheckInsQuery,
  MyAttendance,
  SaveAttendanceBody,
  SaveSessionNoteBody,
  SessionDetail,
  SessionNote,
  UpdateEvaluationBody,
} from '@sports-center/shared';
import { privateApi } from '~/lib/http';

const session = (id: string) => `/sessions/${encodeURIComponent(id)}`;

/** Attendance, session notes, evaluations, class announcements, my training history and check-in. */
export const trainingService = {
  session: async (id: string) => {
    const { data } = await privateApi.get<ApiResponse<SessionDetail>>(session(id));
    return data.result;
  },

  attendance: async (id: string) => {
    const { data } = await privateApi.get<ApiResponse<Attendance[]>>(`${session(id)}/attendance`);
    return data.result;
  },

  saveAttendance: async (id: string, body: SaveAttendanceBody) => {
    const { data } = await privateApi.put<ApiResponse<Attendance[]>>(`${session(id)}/attendance`, body);
    return data.result;
  },

  note: async (id: string) => {
    const { data } = await privateApi.get<ApiResponse<SessionNote | null>>(`${session(id)}/notes`);
    return data.result;
  },

  saveNote: async (id: string, body: SaveSessionNoteBody) => {
    const { data } = await privateApi.put<ApiResponse<SessionNote>>(`${session(id)}/notes`, body);
    return data.result;
  },

  evaluations: async (id: string) => {
    const { data } = await privateApi.get<ApiResponse<Evaluation[]>>(`${session(id)}/evaluations`);
    return data.result;
  },

  createEvaluation: async (id: string, body: CreateEvaluationBody) => {
    const { data } = await privateApi.post<ApiResponse<Evaluation>>(`${session(id)}/evaluations`, body);
    return data.result;
  },

  updateEvaluation: async (id: string, body: UpdateEvaluationBody) => {
    const { data } = await privateApi.patch<ApiResponse<Evaluation>>(`/evaluations/${encodeURIComponent(id)}`, body);
    return data.result;
  },

  deleteEvaluation: async (id: string) => {
    await privateApi.delete(`/evaluations/${encodeURIComponent(id)}`);
  },

  announce: async (classId: string, body: CreateAnnouncementBody) => {
    const { data } = await privateApi.post<ApiResponse<AnnouncementResult>>(
      `/classes/${encodeURIComponent(classId)}/announcements`,
      body,
    );
    return data.result;
  },

  myAttendance: async (classId: string) => {
    const { data } = await privateApi.get<ApiResponse<MyAttendance[]>>('/me/attendance', { params: { classId } });
    return data.result;
  },

  myEvaluations: async (classId: string) => {
    const { data } = await privateApi.get<ApiResponse<Evaluation[]>>('/me/evaluations', { params: { classId } });
    return data.result;
  },

  myCheckIns: async (range: ListMyCheckInsQuery) => {
    const { data } = await privateApi.get<ApiResponse<CheckIn[]>>('/me/checkins', { params: range });
    return data.result;
  },

  checkInsToday: async () => {
    const { data } = await privateApi.get<ApiResponse<CheckIn[]>>('/checkins');
    return data.result;
  },

  checkIn: async (accountId: string) => {
    const { data } = await privateApi.post<ApiResponse<CheckIn>>('/checkins', { accountId });
    return data.result;
  },
};
