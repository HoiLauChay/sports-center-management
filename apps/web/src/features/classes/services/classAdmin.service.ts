import {
  PAGINATION,
  type ApiResponse,
  type AssignCoachBody,
  type CancelClassResult,
  type ClassSession,
  type ClassSummary,
  type Paginated,
  type UpdateClassBody,
  type UpdateSessionBody,
} from '@sports-center/shared';
import { privateApi } from '~/lib/http';
import type { ClassAdminDetail } from '../types';

const path = (id: string) => `/classes/${encodeURIComponent(id)}`;

const listClasses = async (params: Record<string, unknown>) => {
  const { data } = await privateApi.get<ApiResponse<Paginated<ClassSummary>>>('/classes', {
    params: { page: 1, limit: PAGINATION.MAX_LIMIT, ...params },
  });
  return data.result.items;
};

/**
 * Manager class management: `GET /classes/{id}` (with coach registrations for a manager), `PATCH`, approve, reject,
 * cancel, `assign-coach` and `PATCH /sessions/{id}`; the dashboard overview reads `GET /classes` by status.
 */
export const classAdminService = {
  get: async (id: string) => {
    const { data } = await privateApi.get<ApiResponse<ClassAdminDetail>>(path(id));
    return { ...data.result, coachRegistrations: data.result.coachRegistrations ?? [] };
  },

  overview: async () => {
    const [pendingApproval, running] = await Promise.all([
      listClasses({ status: 'PENDING_APPROVAL' }),
      listClasses({ status: 'OPEN' }),
    ]);
    return {
      pendingApproval,
      running: running
        .filter((item) => item.derivedStatus !== 'COMPLETED')
        .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? '')),
    };
  },

  update: async (id: string, body: UpdateClassBody) => {
    const { data } = await privateApi.patch<ApiResponse<ClassAdminDetail>>(path(id), body);
    return data.result;
  },

  approve: async (id: string) => {
    const { data } = await privateApi.post<ApiResponse<ClassAdminDetail>>(`${path(id)}/approve`, {});
    return data.result;
  },

  reject: async (id: string) => {
    const { data } = await privateApi.post<ApiResponse<ClassAdminDetail>>(`${path(id)}/reject`, {});
    return data.result;
  },

  assignCoach: async (id: string, body: AssignCoachBody) => {
    const { data } = await privateApi.post<ApiResponse<ClassAdminDetail>>(`${path(id)}/assign-coach`, body);
    return data.result;
  },

  cancel: async (id: string, reason: string) => {
    const { data } = await privateApi.post<ApiResponse<CancelClassResult>>(`${path(id)}/cancel`, { reason });
    return data.result;
  },

  updateSession: async (id: string, body: UpdateSessionBody) => {
    const { data } = await privateApi.patch<ApiResponse<ClassSession>>(`/sessions/${encodeURIComponent(id)}`, body);
    return data.result;
  },
};
