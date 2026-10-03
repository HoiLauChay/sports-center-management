import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { reportsService } from '../services/reports.service';
import type { ReportRange } from '../types';

export function useOverviewReport() {
  return useQuery({
    queryKey: ['reports', 'overview'],
    queryFn: reportsService.overview,
    refetchInterval: 60_000,
  });
}

export function useRevenueReport(range: ReportRange) {
  return useQuery({
    queryKey: ['reports', 'revenue', range],
    queryFn: () => reportsService.revenue(range),
    placeholderData: keepPreviousData,
  });
}

export function useWalletReport(range: ReportRange) {
  return useQuery({
    queryKey: ['reports', 'wallet', range],
    queryFn: () => reportsService.wallet(range),
    placeholderData: keepPreviousData,
  });
}
