import type { AssignCoachBody } from '@sports-center/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { formatVND } from '~/lib/format';
import { describeApiError } from '~/lib/http-errors';
import { classAdminService } from '../services/classAdmin.service';
import { classesService, type ManagerClassesQuery } from '../services/classes.service';
import type { ClassPatch } from '../types';

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

export function useCoachPool(sportId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['classes', 'coach-pool', sportId],
    queryFn: () => classAdminService.coaches(sportId),
    enabled,
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

export function useApproveClass(classId: string) {
  return useClassAction(classId, () => classAdminService.approve(classId), 'Đã duyệt mở lớp.');
}

export function useRejectClass(classId: string) {
  return useClassAction(classId, () => classAdminService.reject(classId), 'Đã từ chối, lớp về trạng thái nháp.');
}

export function useAssignCoach(classId: string) {
  return useClassAction(
    classId,
    (body: AssignCoachBody) => classAdminService.assignCoach(classId, body),
    'Đã phân công HLV.',
  );
}

export function useCancelClass(classId: string) {
  return useClassAction(
    classId,
    (reason: string) => classAdminService.cancel(classId, reason),
    (result) => `Đã hủy lớp, hoàn trọn ${formatVND(result.refundTotal)} về ví học viên.`,
  );
}

/** Approve / reject straight from the class list, where the class is known per row. */
function useClassListAction(run: (classId: string) => Promise<unknown>, success: string) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      message.success(success);
    },
    onError: (error) => message.error(describeApiError(error)),
  });
}

export function useApproveClassFromList() {
  return useClassListAction((classId) => classesService.approve(classId), 'Đã duyệt mở lớp.');
}

export function useRejectClassFromList() {
  return useClassListAction((classId) => classesService.reject(classId), 'Đã từ chối, lớp về trạng thái nháp.');
}
