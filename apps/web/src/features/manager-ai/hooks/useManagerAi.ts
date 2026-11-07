import type { AutomationKey, MaintenanceAnnounceBody, UpdateAutomationBody } from '@sports-center/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { describeApiError } from '~/lib/http-errors';
import { managerAiService } from '../services/managerAi.service';

const HOUR_MS = 3_600_000;

/** Generated on demand (it costs an AI call), so these are mutations the page triggers with a button. */
export function useReportInsight() {
  return useMutation({ mutationFn: managerAiService.reportInsight });
}

export function useWeeklyDigest() {
  return useQuery({
    queryKey: ['manager-ai', 'digest'],
    queryFn: managerAiService.digest,
    staleTime: 6 * HOUR_MS,
    retry: false,
  });
}

export function useClassReview() {
  return useMutation({ mutationFn: managerAiService.classReview });
}

export function useCoachSuggestions(classId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['manager-ai', 'coach-suggestions', classId],
    queryFn: () => managerAiService.coachSuggestions(classId),
    enabled,
    retry: false,
  });
}

export function useBankSuggestions(transactionId: string | null) {
  return useQuery({
    queryKey: ['manager-ai', 'bank-suggestions', transactionId],
    queryFn: () => managerAiService.bankSuggestions(transactionId!),
    enabled: Boolean(transactionId),
    retry: false,
  });
}

export function useMaintenanceNotice() {
  return useMutation({ mutationFn: managerAiService.maintenanceNotice });
}

export function useAnnounceMaintenance() {
  const { message } = App.useApp();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: MaintenanceAnnounceBody }) =>
      managerAiService.announceMaintenance(id, body),
    onSuccess: ({ sent }) =>
      message.success(sent ? `Đã gửi thông báo tới ${sent} hội viên` : 'Không có hội viên nào cần báo'),
    onError: (error) => message.error(describeApiError(error)),
  });
}

export function useSupportTriage() {
  return useMutation({ mutationFn: managerAiService.supportTriage });
}

const automationsKey = ['manager-ai', 'automations'] as const;

export function useAutomations() {
  return useQuery({ queryKey: automationsKey, queryFn: managerAiService.automations });
}

export function useUpdateAutomation() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, body }: { key: AutomationKey; body: UpdateAutomationBody }) =>
      managerAiService.updateAutomation(key, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: automationsKey });
      message.success('Đã lưu cấu hình tự động hóa');
    },
    onError: (error) => message.error(describeApiError(error)),
  });
}
