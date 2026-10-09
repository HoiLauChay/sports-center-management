import type { ApiResponse } from '@sports-center/shared';
import { privateApi } from '~/lib/http';
import type { OverviewReport, ReportRange, RevenueReport, WalletReport } from '../types';

/** Manager reports (`/reports/overview`, `/reports/revenue`, `/reports/wallet`). */
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
};
