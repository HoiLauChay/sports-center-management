import type {
  ApiResponse,
  CreateMaintenanceBody,
  ListMaintenancesQuery,
  Maintenance,
  MaintenancePreview,
  MaintenanceResult,
  MaintenanceWindow,
} from '@sports-center/shared';
import { privateApi } from '~/lib/http';

/**
 * Facility maintenance (`GET /maintenances`, `POST /maintenances/preview`, `POST /maintenances`,
 * `DELETE /maintenances/{id}`). A 409 `MAINTENANCE_BLOCKED` lists the bookings with nowhere to go in `bookings`.
 */
export const maintenanceService = {
  list: async (query: ListMaintenancesQuery) => {
    const { data } = await privateApi.get<ApiResponse<Maintenance[]>>('/maintenances', { params: query });
    return data.result;
  },

  preview: async (body: MaintenanceWindow) => {
    const { data } = await privateApi.post<ApiResponse<MaintenancePreview>>('/maintenances/preview', body);
    return data.result;
  },

  create: async (body: CreateMaintenanceBody) => {
    const { data } = await privateApi.post<ApiResponse<MaintenanceResult>>('/maintenances', body);
    return data.result;
  },

  remove: async (id: string) => {
    await privateApi.delete(`/maintenances/${encodeURIComponent(id)}`);
  },
};
