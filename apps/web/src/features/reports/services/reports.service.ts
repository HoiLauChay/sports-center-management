import { PAGINATION } from '@sports-center/shared';
import { bankTransactionsService } from '~/features/bank-transactions/services/bankTransactions.service';
import { mockRequest } from '~/lib/mock/errors';
import { overviewReport, revenueReport, walletReport } from '../mocks/reports';
import type { ReportRange } from '../types';

const unmatchedBankTransactions = async () => {
  const page = await bankTransactionsService.list({ page: 1, limit: PAGINATION.MAX_LIMIT, status: 'UNMATCHED' });
  return { count: page.total, amount: page.items.reduce((sum, entry) => sum + entry.amount, 0) };
};

/**
 * Manager reports (`/reports/overview`, `/reports/revenue`, `/reports/wallet`). Mock until #128 ships: figures for
 * past days are deterministic demo data, plus whatever this browser's mock orders added. Swap each body for the
 * matching `privateApi.get` call; the response shapes already follow `api.design.md`. Unmatched bank transactions
 * already come from the real API.
 */
export const reportsService = {
  overview: async () => {
    const unmatched = await unmatchedBankTransactions();
    return mockRequest(() => overviewReport(unmatched.count), 200);
  },

  revenue: ({ from, to, granularity }: ReportRange) => mockRequest(() => revenueReport(from, to, granularity), 300),

  wallet: async ({ from, to, granularity }: ReportRange) => {
    const unmatched = await unmatchedBankTransactions();
    return mockRequest(() => walletReport(from, to, granularity, unmatched), 300);
  },
};
