import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { App } from 'antd';
import { useState } from 'react';
import { describeApiError } from '~/lib/http-errors';
import { reportsService } from '../services/reports.service';
import type { ReportDateQuery, ReportExportFormat, ReportRange, ReportType } from '../types';
import { reportExportFileName, saveReportBlob, toDateQuery } from '../utils';

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

export function useMembersReport(range: Pick<ReportRange, 'from' | 'to'>) {
  const query: ReportDateQuery = toDateQuery(range);
  return useQuery({
    queryKey: ['reports', 'members', query],
    queryFn: () => reportsService.members(query),
    placeholderData: keepPreviousData,
  });
}

export function useFacilitiesReport(range: Pick<ReportRange, 'from' | 'to'>) {
  const query: ReportDateQuery = toDateQuery(range);
  return useQuery({
    queryKey: ['reports', 'facilities', query],
    queryFn: () => reportsService.facilities(query),
    placeholderData: keepPreviousData,
  });
}

export function useCoursesReport(range: Pick<ReportRange, 'from' | 'to'>) {
  const query: ReportDateQuery = toDateQuery(range);
  return useQuery({
    queryKey: ['reports', 'courses', query],
    queryFn: () => reportsService.courses(query),
    placeholderData: keepPreviousData,
  });
}

export function useReportExport() {
  const { message } = App.useApp();
  const [downloading, setDownloading] = useState<ReportExportFormat | null>(null);

  const exportReport = async (report: ReportType, format: ReportExportFormat, range: ReportRange) => {
    try {
      setDownloading(format);
      const blob = await reportsService.exportBlob({
        report,
        format,
        from: range.from,
        to: range.to,
        granularity: range.granularity,
      });
      const fileName = reportExportFileName(report, format, range);
      saveReportBlob(blob, fileName, format);
      message.success(`Đã tải xuống ${fileName}`);
    } catch (error) {
      message.error(describeApiError(error));
    } finally {
      setDownloading(null);
    }
  };

  return {
    downloading,
    isExporting: downloading !== null,
    exportReport,
  };
}
