import { zodResolver } from '@hookform/resolvers/zod';
import { firstPasswordBodySchema, type Account, type FirstPasswordBody } from '@sports-center/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch, type HistoryState } from '@tanstack/react-router';
import { App } from 'antd';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { PATHS } from '~/constants/paths';
import { useConfirm } from '~/hooks/useConfirm';
import { useFormApiError } from '~/hooks/useFormApiError';
import { safeRedirectPath } from '~/lib/access';
import {
  changePasswordSchema,
  registerSchema,
  type ChangePasswordFormValues,
  type RegisterFormValues,
} from '../schemas/auth.schema';
import { authService } from '../services/auth.service';
import { sessionQueryOptions } from '../session';
import { AUTH_ERROR_FIELDS, CHANGE_PASSWORD_ERROR_FIELDS } from '../utils/authErrorFields';

export function useCompleteAuth() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search: { redirect?: unknown } = useSearch({ strict: false });
  return useCallback(
    (user: Account) => {
      queryClient.setQueryData(sessionQueryOptions.queryKey, user);
      void navigate({ href: safeRedirectPath(search.redirect) ?? PATHS.dashboard });
    },
    [navigate, queryClient, search.redirect],
  );
}

interface EndSessionTarget {
  to?: typeof PATHS.login | typeof PATHS.forgotPassword;
  state?: HistoryState;
}

function useEndSession() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useCallback(
    async (successMessage?: string, { to = PATHS.login, state }: EndSessionTarget = {}) => {
      queryClient.setQueryData(sessionQueryOptions.queryKey, null);
      await navigate({ to, state });
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
      if (successMessage) message.success(successMessage);
    },
    [message, navigate, queryClient],
  );
}

export function useRegister() {
  const { message } = App.useApp();
  const completeAuth = useCompleteAuth();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: { email: '', otp: '', fullName: '', password: '', confirmPassword: '', agree: false },
  });
  const handleApiError = useFormApiError(form, AUTH_ERROR_FIELDS);

  const mutation = useMutation({
    mutationFn: ({ email, otp, fullName, password, confirmPassword }: RegisterFormValues) =>
      authService.register({ email, otp, fullName, password, confirmPassword }),
    onSuccess: (user) => {
      message.success('Đăng ký thành công');
      completeAuth(user);
    },
    onError: handleApiError,
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return { form, onSubmit, isSubmitting: mutation.isPending };
}

export function useLogout() {
  const endSession = useEndSession();

  return useCallback(async () => {
    await authService.logout().catch(() => undefined);
    await endSession('Đã đăng xuất');
  }, [endSession]);
}

export function useChangePassword() {
  const endSession = useEndSession();

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    mode: 'onTouched',
    defaultValues: { currentPassword: '', password: '', confirmPassword: '' },
  });
  const handleApiError = useFormApiError(form, CHANGE_PASSWORD_ERROR_FIELDS);

  const mutation = useMutation({
    mutationFn: (values: ChangePasswordFormValues) => authService.changePassword(values),
    onSuccess: () => endSession('Đổi mật khẩu thành công, vui lòng đăng nhập lại'),
    onError: handleApiError,
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return { form, onSubmit, isSubmitting: mutation.isPending };
}

export function useSetFirstPassword() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const form = useForm<FirstPasswordBody>({
    resolver: zodResolver(firstPasswordBodySchema),
    mode: 'onTouched',
    defaultValues: { password: '', confirmPassword: '' },
  });
  const handleApiError = useFormApiError(form);

  const mutation = useMutation({
    mutationFn: (values: FirstPasswordBody) => authService.setFirstPassword(values),
    onSuccess: (user) => {
      queryClient.setQueryData(sessionQueryOptions.queryKey, user);
      form.reset();
      message.success('Đã đặt mật khẩu, lần sau bạn có thể đăng nhập bằng email và mật khẩu này');
    },
    onError: handleApiError,
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return { form, onSubmit, isSubmitting: mutation.isPending };
}

export function useLogoutAll() {
  const { message } = App.useApp();
  const confirm = useConfirm();
  const endSession = useEndSession();

  return () =>
    confirm({
      title: 'Đăng xuất khỏi mọi thiết bị?',
      content: 'Tất cả phiên đăng nhập, kể cả thiết bị này, sẽ bị đăng xuất.',
      okText: 'Đăng xuất tất cả',
      onOk: async () => {
        try {
          await authService.logoutAll();
          await endSession('Đã đăng xuất khỏi tất cả thiết bị');
        } catch {
          message.error('Không thể đăng xuất, vui lòng thử lại.');
        }
      },
    });
}

export function useForgotCurrentPassword() {
  const endSession = useEndSession();

  return useCallback(
    async (email: string) => {
      await authService.logout().catch(() => undefined);
      await endSession(undefined, { to: PATHS.forgotPassword, state: { resetEmail: email } });
    },
    [endSession],
  );
}
