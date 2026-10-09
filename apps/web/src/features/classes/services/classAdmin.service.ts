import type { ApiResponse, AssignCoachBody, CancelClassResult, UpdateClassBody } from '@sports-center/shared';
import { loadCatalog } from '~/features/checkout/mocks/pricing';
import { privateApi } from '~/lib/http';
import { mockRequest } from '~/lib/mock/errors';
import { classOverview } from '../mocks/classAdmin';
import { ensureClassSeed } from '../mocks/classes';
import type { ClassAdminDetail } from '../types';

const path = (id: string) => `/classes/${encodeURIComponent(id)}`;

/**
 * Manager class management: `GET /classes/{id}` (with coach registrations for a manager), `PATCH`, approve, reject,
 * cancel and `assign-coach`. The dashboard overview stays mock until the class figures have an endpoint.
 */
export const classAdminService = {
  get: async (id: string) => {
    const { data } = await privateApi.get<ApiResponse<ClassAdminDetail>>(path(id));
    return { ...data.result, coachRegistrations: data.result.coachRegistrations ?? [] };
  },

  overview: () =>
    mockRequest(async () => {
      const catalog = await loadCatalog();
      ensureClassSeed(catalog.facilities, catalog.settings);
      return classOverview();
    }, 150),

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
};
