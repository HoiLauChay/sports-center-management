import type {
  ClassSummary,
  CreateAnnouncementBody,
  CreateEvaluationBody,
  ListMyCheckInsQuery,
  SaveAttendanceBody,
  SaveSessionNoteBody,
} from '@sports-center/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useMemo } from 'react';
import { useMyEnrollments } from '~/features/classes/hooks/useClasses';
import { describeApiError } from '~/lib/http-errors';
import { trainingService } from '../services/training.service';

const sessionKey = (sessionId: string, part: string) => ['training', 'session', sessionId, part] as const;

export function useTrainingSession(sessionId: string) {
  return useQuery({
    queryKey: sessionKey(sessionId, 'info'),
    queryFn: () => trainingService.session(sessionId),
    retry: false,
  });
}

export function useAttendance(sessionId: string) {
  return useQuery({
    queryKey: sessionKey(sessionId, 'attendance'),
    queryFn: () => trainingService.attendance(sessionId),
  });
}

export function useSessionNote(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionKey(sessionId ?? '', 'note'),
    queryFn: () => trainingService.note(sessionId!),
    enabled: Boolean(sessionId),
    retry: false,
  });
}

export function useSessionEvaluations(sessionId: string) {
  return useQuery({
    queryKey: sessionKey(sessionId, 'evaluations'),
    queryFn: () => trainingService.evaluations(sessionId),
  });
}

/** A write on the coach's session page: refreshes the session's data and reports the outcome. */
function useSessionAction<V, R>(
  sessionId: string,
  run: (variables: V) => Promise<R>,
  success: string | ((result: R) => string),
  parts: string[],
) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (result) => {
      for (const part of parts) void queryClient.invalidateQueries({ queryKey: sessionKey(sessionId, part) });
      void queryClient.invalidateQueries({ queryKey: ['training', 'mine'] });
      message.success(typeof success === 'function' ? success(result) : success);
    },
    onError: (error) => message.error(describeApiError(error)),
  });
}

export function useSaveAttendance(sessionId: string) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveAttendanceBody) => trainingService.saveAttendance(sessionId, body),
    onSuccess: (records) => {
      queryClient.setQueryData(sessionKey(sessionId, 'attendance'), records);
      void queryClient.invalidateQueries({ queryKey: ['training', 'mine'] });
      message.success('Đã lưu điểm danh cả lớp.');
    },
    onError: (error) => message.error(describeApiError(error)),
  });
}

export function useSaveNote(sessionId: string) {
  return useSessionAction(
    sessionId,
    (body: SaveSessionNoteBody) => trainingService.saveNote(sessionId, body),
    'Đã lưu ghi chú buổi học.',
    ['note'],
  );
}

export function useCreateEvaluation(sessionId: string) {
  return useSessionAction(
    sessionId,
    (body: CreateEvaluationBody) => trainingService.createEvaluation(sessionId, body),
    'Đã lưu đánh giá.',
    ['evaluations'],
  );
}

export function useUpdateEvaluation(sessionId: string) {
  return useSessionAction(
    sessionId,
    ({ id, ...body }: { id: string; rating: number; comment: string }) => trainingService.updateEvaluation(id, body),
    'Đã cập nhật đánh giá.',
    ['evaluations'],
  );
}

export function useDeleteEvaluation(sessionId: string) {
  return useSessionAction(sessionId, (id: string) => trainingService.deleteEvaluation(id), 'Đã xóa đánh giá.', [
    'evaluations',
  ]);
}

export function useSendAnnouncement(classId: string) {
  const { message } = App.useApp();
  return useMutation({
    mutationFn: (body: CreateAnnouncementBody) => trainingService.announce(classId, body),
    onSuccess: ({ recipients }) => message.success(`Đã gửi thông báo cho ${recipients} học viên.`),
    onError: (error) => message.error(describeApiError(error)),
  });
}

/** The classes I joined (also ones I left), newest enrollment first, for the training history. */
export function useMyTrainingClasses() {
  const enrollments = useMyEnrollments();
  const data = useMemo(() => {
    if (!enrollments.data) return undefined;
    const byClass = new Map<string, ClassSummary>();
    for (const entry of [...enrollments.data].sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt))) {
      if (!byClass.has(entry.class.id)) byClass.set(entry.class.id, entry.class);
    }
    return [...byClass.values()];
  }, [enrollments.data]);
  return { ...enrollments, data };
}

export function useMyAttendance(classId: string | undefined) {
  return useQuery({
    queryKey: ['training', 'mine', 'attendance', classId],
    queryFn: () => trainingService.myAttendance(classId!),
    enabled: Boolean(classId),
    placeholderData: keepPreviousData,
  });
}

export function useMyEvaluations(classId: string | undefined) {
  return useQuery({
    queryKey: ['training', 'mine', 'evaluations', classId],
    queryFn: () => trainingService.myEvaluations(classId!),
    enabled: Boolean(classId),
    placeholderData: keepPreviousData,
  });
}

export function useMyCheckIns(range: ListMyCheckInsQuery) {
  return useQuery({
    queryKey: ['training', 'mine', 'checkins', range],
    queryFn: () => trainingService.myCheckIns(range),
    placeholderData: keepPreviousData,
  });
}

export function useCheckInsToday() {
  return useQuery({
    queryKey: ['training', 'checkins', 'today'],
    queryFn: () => trainingService.checkInsToday(),
    refetchInterval: 15_000,
  });
}

export function useCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => trainingService.checkIn(accountId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['training', 'checkins'] }),
  });
}
