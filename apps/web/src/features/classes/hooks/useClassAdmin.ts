import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useCurrentUser } from '~/features/auth';
import { formatVND } from '~/lib/format';
import { describeApiError } from '~/lib/http-errors';
import { classAdminService } from '../services/classAdmin.service';
import type { ClassPatch, SessionPatch } from '../types';

const adminKey = (id: string) => ['classes', 'admin', id] as const;

export function useClassAdmin(id: string) {
  return useQuery({ queryKey: adminKey(id), queryFn: () => classAdminService.get(id), retry: false });
}

export function useClassOverview() {
  return useQuery({ queryKey: ['classes', 'overview'], queryFn: () => classAdminService.overview() });
}

export function useCoachPool() {
  return useQuery({ queryKey: ['classes', 'coach-pool'], queryFn: () => classAdminService.coaches() });
}

export function useClassRefundPreview(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ['classes', 'refund-preview', id],
    queryFn: () => classAdminService.classRefundPreview(id),
    enabled,
    gcTime: 0,
  });
}

export function useSessionRefundPreview(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['classes', 'session-refund-preview', sessionId],
    queryFn: () => classAdminService.sessionRefundPreview(sessionId!),
    enabled: Boolean(sessionId),
    gcTime: 0,
    retry: false,
  });
}

/** Runs a class-management action, refreshes everything the class touches and reports the outcome. */
function useClassAction<V, R>(
  classId: string,
  run: (variables: V) => Promise<R>,
  success: string | ((result: R) => string),
) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: adminKey(classId) });
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      void queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['schedule'] });
      message.success(typeof success === 'function' ? success(result) : success);
    },
    onError: (error) => message.error(describeApiError(error)),
  });
}

export function useUpdateClass(classId: string) {
  return useClassAction(
    classId,
    (patch: ClassPatch) => classAdminService.update(classId, patch),
    'Đã lưu thông tin lớp.',
  );
}

export function useSetMinStudentsOverride(classId: string) {
  return useClassAction(
    classId,
    (override: boolean) => classAdminService.setMinStudentsOverride(classId, override),
    'Đã cập nhật kiểm tra sĩ số.',
  );
}

export function useApproveClass(classId: string) {
  return useClassAction(classId, () => classAdminService.approve(classId), 'Đã duyệt mở lớp.');
}

export function useRejectClass(classId: string) {
  return useClassAction(classId, () => classAdminService.reject(classId), 'Đã từ chối, lớp về trạng thái nháp.');
}

export function useAssignCoach(classId: string) {
  return useClassAction(
    classId,
    (input: { registrationId: string } | { coachId: string }) => classAdminService.assignCoach(classId, input),
    'Đã phân công HLV.',
  );
}

export function useCancelClass(classId: string) {
  const user = useCurrentUser();
  return useClassAction(
    classId,
    (reason: string) => classAdminService.cancel(user, classId, reason),
    (result) => `Đã hủy lớp, hoàn ${formatVND(result.refundTotal)} về ví học viên.`,
  );
}

export function useUpdateSession(classId: string) {
  return useClassAction(
    classId,
    (input: { sessionId: string; patch: SessionPatch }) =>
      classAdminService.updateSession(input.sessionId, input.patch),
    'Đã cập nhật buổi học.',
  );
}

export function useCancelSession(classId: string) {
  const user = useCurrentUser();
  return useClassAction(
    classId,
    (input: { sessionId: string; reason: string }) =>
      classAdminService.cancelSession(user, input.sessionId, input.reason),
    (result) =>
      result.refundTotal > 0
        ? `Đã hủy buổi học, hoàn ${formatVND(result.refundTotal)} về ví học viên.`
        : 'Đã hủy buổi học.',
  );
}
