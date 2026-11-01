import type { ApiResponse } from '@sports-center/shared';
import { privateApi } from '~/lib/http';
import type {
  CoursesReport,
  FacilitiesReport,
  MembersReport,
  OverviewReport,
  ReportDateQuery,
  ReportExportQuery,
  ReportRange,
  RevenueReport,
  WalletReport,
} from '../types';

/** Manager reports (`/reports/overview`, `/reports/revenue`, `/reports/wallet`, `/reports/members`, `/reports/facilities`, `/reports/courses`, `/reports/export`). */
export const reportsService = {
  overview: async () => {
    const { data } = await privateApi.get<ApiResponse<OverviewReport>>('/reports/overview');
    return data.result;
  },

  revenue: async (params: ReportRange) => {
    const { data } = await privateApi.get<ApiResponse<RevenueReport>>('/reports/revenue', { params });
    return data.result;
  },

  wallet: async (params: ReportRange) => {
    const { data } = await privateApi.get<ApiResponse<WalletReport>>('/reports/wallet', { params });
    return data.result;
  },

  members: async (params: ReportDateQuery) => {
    const { data } = await privateApi.get<ApiResponse<MembersReport>>('/reports/members', { params });
    return data.result;
  },

  facilities: async (params: ReportDateQuery) => {
    const { data } = await privateApi.get<ApiResponse<FacilitiesReport>>('/reports/facilities', { params });
    return data.result;
  },

  courses: async (params: ReportDateQuery) => {
    const { data } = await privateApi.get<ApiResponse<CoursesReport>>('/reports/courses', { params });
    return data.result;
  },

  exportBlob: async (params: ReportExportQuery) => {
    const { data } = await privateApi.get<Blob>('/reports/export', {
      params,
      responseType: 'blob',
    });
    return data;
  },
};
