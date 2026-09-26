import { zodResolver } from '@hookform/resolvers/zod';
import type { Account } from '@sports-center/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { App } from 'antd';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { PATHS } from '~/constants/paths';
import { useFormApiError } from '~/hooks/useFormApiError';
import { safeRedirectPath } from '~/lib/access';
import {
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type LoginFormValues,
  type RegisterFormValues,
  type ResetPasswordFormValues,
} from '../schemas/auth.schema';
import { authService } from '../services/auth.service';
import { sessionQueryOptions } from '../session';
import { AUTH_ERROR_FIELDS } from '../utils/authErrorFields';

function useCompleteAuth() {
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

export function useLogin() {
  const { message } = App.useApp();
  const completeAuth = useCompleteAuth();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });
  const handleApiError = useFormApiError(form, AUTH_ERROR_FIELDS);

  const mutation = useMutation({
    mutationFn: (values: LoginFormValues) => authService.login(values),
    onSuccess: (user) => {
      message.success('Đăng nhập thành công');
      completeAuth(user);
    },
    onError: handleApiError,
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return { form, onSubmit, isSubmitting: mutation.isPending };
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

export function useResetPassword() {
  const [done, setDone] = useState(false);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onTouched',
    defaultValues: { email: '', otp: '', password: '', confirmPassword: '' },
  });
  const handleApiError = useFormApiError(form, AUTH_ERROR_FIELDS);

  const mutation = useMutation({
    mutationFn: (values: ResetPasswordFormValues) => authService.resetPassword(values),
    onSuccess: () => setDone(true),
    onError: handleApiError,
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return { form, onSubmit, isSubmitting: mutation.isPending, done };
}

/** Clears the cached session and user data, then sends the user to the login page. */
export function useEndSession() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useCallback(
    async (successMessage: string) => {
      queryClient.setQueryData(sessionQueryOptions.queryKey, null);
      await navigate({ to: PATHS.login });
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
      message.success(successMessage);
    },
    [message, navigate, queryClient],
  );
}

export function useLogout() {
  const endSession = useEndSession();

  return useCallback(async () => {
    await authService.logout().catch(() => undefined);
    await endSession('Đã đăng xuất');
  }, [endSession]);
}
