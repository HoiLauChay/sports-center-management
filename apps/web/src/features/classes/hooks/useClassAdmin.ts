import { PAGINATION, type AssignCoachBody, type UpdateClassBody, type UpdateSessionBody } from '@sports-center/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { specializationsService } from '~/features/specializations/services/specializations.service';
import { formatVND } from '~/lib/format';
import { describeApiError } from '~/lib/http-errors';
import { classAdminService } from '../services/classAdmin.service';
import { classesService, type ManagerClassesQuery } from '../services/classes.service';

const adminKey = (id: string) => ['classes', 'admin', id] as const;

export function useClassAdmin(id: string) {
  return useQuery({ queryKey: adminKey(id), queryFn: () => classAdminService.get(id), retry: false });
}

export function useManagerClasses(query: ManagerClassesQuery) {
  return useQuery({
    queryKey: ['classes', 'manager-list', query],
    queryFn: () => classesService.listForManager(query),
    placeholderData: keepPreviousData,
  });
}

export function useClassOverview() {
  return useQuery({ queryKey: ['classes', 'overview'], queryFn: () => classAdminService.overview() });
}

/** Coaches approved for the sport, the only ones `assign-coach` accepts (BR_2.14). */
export function useCoachPool(sportId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['specializations', 'coach-pool', sportId],
    queryFn: () => specializationsService.list({ status: 'APPROVED', sportId, page: 1, limit: PAGINATION.MAX_LIMIT }),
    select: (page) => page.items.map((entry) => entry.coach),
    enabled,
  });
}

/** Runs a class-management action, refreshes everything the class touches and reports the outcome. */
function useClassAction<V, R>(run: (variables: V) => Promise<R>, success: string | ((result: R) => string)) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (result) => {
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
  return useClassAction((patch: UpdateClassBody) => classAdminService.update(classId, patch), 'Đã lưu thông tin lớp.');
}

export function useApproveClass(classId: string) {
  return useClassAction(() => classAdminService.approve(classId), 'Đã duyệt mở lớp.');
}

export function useRejectClass(classId: string) {
  return useClassAction(() => classAdminService.reject(classId), 'Đã từ chối, lớp về trạng thái nháp.');
}

export function useAssignCoach(classId: string) {
  return useClassAction((body: AssignCoachBody) => classAdminService.assignCoach(classId, body), 'Đã phân công HLV.');
}

export function useCancelClass(classId: string) {
  return useClassAction(
    (reason: string) => classAdminService.cancel(classId, reason),
    (result) => `Đã hủy lớp, hoàn trọn ${formatVND(result.refundTotal)} về ví học viên.`,
  );
}

/** Approve / reject straight from the class list, where the class is known per row. */
export function useApproveClassFromList() {
  return useClassAction((classId: string) => classAdminService.approve(classId), 'Đã duyệt mở lớp.');
}

export function useRejectClassFromList() {
  return useClassAction((classId: string) => classAdminService.reject(classId), 'Đã từ chối, lớp về trạng thái nháp.');
}

/** `PATCH /sessions/{id}`: moves one session to another time or facility; a clash is left to the caller. */
export function useUpdateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSessionBody }) => classAdminService.updateSession(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      void queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
  });
}
