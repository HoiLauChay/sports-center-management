import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useCurrentUser } from '~/features/auth';
import { describeApiError } from '~/lib/http-errors';
import { coachClassesService } from '../services/coachClasses.service';

export function useOpenClasses() {
  const user = useCurrentUser();
  return useQuery({
    queryKey: ['classes', 'coach-open', user.id],
    queryFn: () => coachClassesService.listOpenClasses(),
  });
}

/** Class ids this coach is waiting on: a pending registration is not shown again as `Đăng ký dạy`. */
export function usePendingRegistrations() {
  const user = useCurrentUser();
  return useQuery({
    queryKey: ['classes', 'coach-registrations', user.id],
    queryFn: () => coachClassesService.myRegistrations({ status: 'PENDING' }),
    select: (registrations) => new Set(registrations.map((registration) => registration.classId)),
  });
}

export function useMyClasses() {
  const user = useCurrentUser();
  return useQuery({
    queryKey: ['classes', 'coach-mine', user.id],
    queryFn: coachClassesService.listMyClasses,
  });
}

/** Registering to teach / withdrawing: refreshes every class list and reports the outcome. */
function useCoachAction(run: (classId: string) => Promise<unknown>, success: string) {
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

export function useRegisterToTeach() {
  return useCoachAction(coachClassesService.registerToTeach, 'Đã đăng ký dạy, chờ Quản lý chọn HLV.');
}

export function useWithdrawFromClass() {
  return useCoachAction(coachClassesService.withdraw, 'Đã rút khỏi lớp, lớp quay về chờ HLV.');
}
