import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useCurrentUser } from '~/features/auth';
import { describeApiError } from '~/lib/http-errors';
import { trainingService } from '../services/training.service';
import type { AttendanceInput, EvaluationInput, SessionNoteInput } from '../types';

const sessionKey = (sessionId: string, part: string) => ['training', 'session', sessionId, part] as const;

export function useTrainingSession(sessionId: string) {
  const user = useCurrentUser();
  return useQuery({
    queryKey: sessionKey(sessionId, 'info'),
    queryFn: () => trainingService.session(user, sessionId),
    retry: false,
  });
}

export function useAttendance(sessionId: string) {
  const user = useCurrentUser();
  return useQuery({
    queryKey: sessionKey(sessionId, 'attendance'),
    queryFn: () => trainingService.attendance(user, sessionId),
  });
}

export function useSessionNote(sessionId: string | undefined) {
  const user = useCurrentUser();
  return useQuery({
    queryKey: sessionKey(sessionId ?? '', 'note'),
    queryFn: () => trainingService.note(user, sessionId!),
    enabled: Boolean(sessionId),
    retry: false,
  });
}

export function useSessionEvaluations(sessionId: string) {
  const user = useCurrentUser();
  return useQuery({
    queryKey: sessionKey(sessionId, 'evaluations'),
    queryFn: () => trainingService.evaluations(user, sessionId),
  });
}

export function useClassAnnouncements(classId: string | undefined) {
  const user = useCurrentUser();
  return useQuery({
    queryKey: ['training', 'announcements', classId],
    queryFn: () => trainingService.announcements(user, classId!),
    enabled: Boolean(classId),
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
  const user = useCurrentUser();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (records: AttendanceInput[]) => trainingService.saveAttendance(user, sessionId, records),
    onSuccess: (records) => {
      queryClient.setQueryData(sessionKey(sessionId, 'attendance'), records);
      void queryClient.invalidateQueries({ queryKey: ['training', 'mine'] });
      message.success('Đã lưu điểm danh cả lớp.');
    },
    onError: (error) => message.error(describeApiError(error)),
  });
}

export function useSaveNote(sessionId: string) {
  const user = useCurrentUser();
  return useSessionAction(
    sessionId,
    (input: SessionNoteInput) => trainingService.saveNote(user, sessionId, input),
    'Đã lưu ghi chú buổi học.',
    ['note'],
  );
}

export function useCreateEvaluation(sessionId: string) {
  const user = useCurrentUser();
  return useSessionAction(
    sessionId,
    (input: EvaluationInput) => trainingService.createEvaluation(user, sessionId, input),
    'Đã lưu đánh giá.',
    ['evaluations'],
  );
}

export function useUpdateEvaluation(sessionId: string) {
  const user = useCurrentUser();
  return useSessionAction(
    sessionId,
    (input: { id: string; rating: number; comment: string }) =>
      trainingService.updateEvaluation(user, input.id, { rating: input.rating, comment: input.comment }),
    'Đã cập nhật đánh giá.',
    ['evaluations'],
  );
}

export function useDeleteEvaluation(sessionId: string) {
  const user = useCurrentUser();
  return useSessionAction(sessionId, (id: string) => trainingService.deleteEvaluation(user, id), 'Đã xóa đánh giá.', [
    'evaluations',
  ]);
}

export function useSendAnnouncement(classId: string) {
  const user = useCurrentUser();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; body: string }) => trainingService.announce(user, classId, input),
    onSuccess: ({ recipients }) => {
      void queryClient.invalidateQueries({ queryKey: ['training', 'announcements', classId] });
      message.success(`Đã gửi thông báo cho ${recipients} học viên.`);
    },
    onError: (error) => message.error(describeApiError(error)),
  });
}

export function useMyTrainingClasses() {
  const user = useCurrentUser();
  return useQuery({
    queryKey: ['training', 'mine', 'classes', user.id],
    queryFn: () => trainingService.myClasses(user),
  });
}

export function useMyAttendance(classId: string | undefined) {
  const user = useCurrentUser();
  return useQuery({
    queryKey: ['training', 'mine', 'attendance', user.id, classId],
    queryFn: () => trainingService.myAttendance(user, classId),
    enabled: Boolean(classId),
    placeholderData: keepPreviousData,
  });
}

export function useMyEvaluations(classId: string | undefined) {
  const user = useCurrentUser();
  return useQuery({
    queryKey: ['training', 'mine', 'evaluations', user.id, classId],
    queryFn: () => trainingService.myEvaluations(user, classId),
    enabled: Boolean(classId),
    placeholderData: keepPreviousData,
  });
}

export function useMyCheckIns(range: { from?: string; to?: string }) {
  const user = useCurrentUser();
  return useQuery({
    queryKey: ['training', 'mine', 'checkins', user.id, range],
    queryFn: () => trainingService.myCheckIns(user, range),
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

export function useCheckInCheck(memberId: string | undefined) {
  const user = useCurrentUser();
  return useQuery({
    queryKey: ['training', 'checkin-check', memberId],
    queryFn: () => trainingService.checkInCheck(user, memberId!),
    enabled: Boolean(memberId),
    retry: false,
    gcTime: 0,
  });
}

export function useCheckIn() {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => trainingService.checkIn(user, memberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['training', 'checkins'] });
      void queryClient.invalidateQueries({ queryKey: ['training', 'checkin-check'] });
      void queryClient.invalidateQueries({ queryKey: ['training', 'mine'] });
    },
  });
}
