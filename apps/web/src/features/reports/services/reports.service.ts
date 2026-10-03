import { mockRequest } from '~/lib/mock/errors';
import { overviewReport, revenueReport, walletReport } from '../mocks/reports';
import type { ReportRange } from '../types';

/**
 * Manager reports (`/reports/overview`, `/reports/revenue`, `/reports/wallet`). Mock until #128 ships: figures for
 * past days are deterministic demo data, plus whatever this browser's mock orders added. Swap each body for the
 * matching `privateApi.get` call; the response shapes already follow `api.design.md`.
 */
export const reportsService = {
  overview: () => mockRequest(() => overviewReport(), 200),

  revenue: ({ from, to, granularity }: ReportRange) => mockRequest(() => revenueReport(from, to, granularity), 300),

  wallet: ({ from, to, granularity }: ReportRange) => mockRequest(() => walletReport(from, to, granularity), 300),
};
