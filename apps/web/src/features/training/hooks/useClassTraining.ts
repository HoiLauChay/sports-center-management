import type { ProgressMilestone, SaveProgressReviewBody, SaveTrainingPlanBody } from '@sports-center/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { describeApiError } from '~/lib/http-errors';
import { classTrainingService } from '../services/classTraining.service';

const classKey = (classId: string, ...parts: string[]) => ['training', 'class', classId, ...parts] as const;

export function useRoster(classId: string) {
  return useQuery({ queryKey: classKey(classId, 'roster'), queryFn: () => classTrainingService.roster(classId) });
}

export function useStudentProgress(classId: string, accountId: string | null) {
  return useQuery({
    queryKey: classKey(classId, 'student', accountId ?? ''),
    queryFn: () => classTrainingService.student(classId, accountId!),
    enabled: Boolean(accountId),
  });
}

export function useClassPlans(classId: string) {
  return useQuery({ queryKey: classKey(classId, 'plans'), queryFn: () => classTrainingService.plans(classId) });
}

export function useAnnouncements(classId: string) {
  return useQuery({
    queryKey: classKey(classId, 'announcements'),
    queryFn: () => classTrainingService.announcements(classId),
  });
}

export function useMyClassTraining(classId: string | undefined) {
  return useQuery({
    queryKey: ['training', 'mine', 'class', classId],
    queryFn: () => classTrainingService.myTraining(classId!),
    enabled: Boolean(classId),
  });
}

/** A coach's write on a class: refreshes everything shown about the class and reports the outcome. */
function useClassAction<V>(classId: string, run: (variables: V) => Promise<unknown>, success: string) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: classKey(classId) });
      message.success(success);
    },
    onError: (error) => message.error(describeApiError(error)),
  });
}

export function useSaveClassPlan(classId: string) {
  return useClassAction(
    classId,
    (body: SaveTrainingPlanBody) => classTrainingService.saveClassPlan(classId, body),
    'Đã lưu kế hoạch chung của lớp.',
  );
}

export function useSaveMemberPlan(classId: string, accountId: string) {
  return useClassAction(
    classId,
    (body: SaveTrainingPlanBody) => classTrainingService.saveMemberPlan(classId, accountId, body),
    'Đã lưu kế hoạch riêng, học viên được thông báo.',
  );
}

export function useSaveReview(classId: string, accountId: string) {
  return useClassAction(
    classId,
    ({ milestone, ...body }: SaveProgressReviewBody & { milestone: ProgressMilestone }) =>
      classTrainingService.saveReview(classId, accountId, milestone, body),
    'Đã lưu đánh giá tiến độ.',
  );
}
