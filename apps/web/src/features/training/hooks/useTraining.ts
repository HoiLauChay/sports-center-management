import type {
  CreateAnnouncementBody,
  Evaluation,
  ListMyCheckInsQuery,
  SaveAttendanceBody,
  SaveSessionNoteBody,
} from '@sports-center/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { describeApiError } from '~/lib/http-errors';
import { todayVN } from '~/lib/time';
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

/** Saves a whole attendance list for a session, e.g. one the assistant prepared. */
export function useSaveAttendance(sessionId: string) {
  return useSessionAction(
    sessionId,
    (body: SaveAttendanceBody) => trainingService.saveAttendance(sessionId, body),
    'Đã lưu điểm danh.',
    ['attendance'],
  );
}

export interface RosterSave {
  attendance: SaveAttendanceBody['records'] | null;
  results: { accountId: string; evaluation?: Evaluation; rating: number; comment: string }[];
}

/** Saves attendance first (results need the student marked present), then each changed result. */
export function useSaveSessionRoster(sessionId: string) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ attendance, results }: RosterSave) => {
      if (attendance) await trainingService.saveAttendance(sessionId, { records: attendance });
      for (const { accountId, evaluation, rating, comment } of results) {
        if (!rating) await trainingService.deleteEvaluation(evaluation!.id);
        else if (evaluation) await trainingService.updateEvaluation(evaluation.id, { rating, comment });
        else await trainingService.createEvaluation(sessionId, { accountId, rating, comment: comment || undefined });
      }
    },
    onSuccess: () => message.success('Đã lưu điểm danh và kết quả buổi.'),
    onError: (error) => message.error(describeApiError(error)),
    onSettled: () => {
      for (const part of ['attendance', 'evaluations']) {
        void queryClient.invalidateQueries({ queryKey: sessionKey(sessionId, part) });
      }
      void queryClient.invalidateQueries({ queryKey: ['training', 'mine'] });
      void queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
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

export function useSendAnnouncement(classId: string) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAnnouncementBody) => trainingService.announce(classId, body),
    onSuccess: ({ recipients }) => {
      void queryClient.invalidateQueries({ queryKey: ['training', 'class', classId, 'announcements'] });
      message.success(`Đã gửi cho ${recipients} học viên.`);
    },
    onError: (error) => message.error(describeApiError(error)),
  });
}

/** The classes I joined (also ones I left), newest enrollment first, for the training history. */

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

export function useCheckIns(date?: string) {
  const isToday = !date || date === todayVN();
  return useQuery({
    queryKey: ['training', 'checkins', isToday ? 'today' : date],
    queryFn: () => trainingService.checkIns(isToday ? undefined : date),
    placeholderData: keepPreviousData,
    refetchInterval: isToday ? 15_000 : false,
  });
}

export function useCheckInsToday() {
  return useCheckIns();
}

export function useCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => trainingService.checkIn(accountId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['training', 'checkins'] }),
  });
}
