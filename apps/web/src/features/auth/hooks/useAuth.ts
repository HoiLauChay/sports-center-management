import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { App } from 'antd';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { PATHS } from '~/constants/paths';
import { useAuthContext } from '../context/AuthContext';
import {
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type LoginFormValues,
  type RegisterFormValues,
  type ResetPasswordFormValues,
} from '../schemas/auth.schema';
import { authService } from '../services/auth.service';
import type { AuthUser } from '../types';
import { useFormApiError } from './useFormApiError';

const REDIRECT_AFTER_AUTH = PATHS.app;

function useCompleteAuth() {
  const navigate = useNavigate();
  const { setUser } = useAuthContext();
  return useCallback(
    (user: AuthUser) => {
      setUser(user);
      void navigate({ to: REDIRECT_AFTER_AUTH });
    },
    [navigate, setUser],
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
  const handleApiError = useFormApiError(form);

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
    defaultValues: { email: '', otp: '', password: '', confirmPassword: '', agree: false },
  });
  const handleApiError = useFormApiError(form);

  const mutation = useMutation({
    mutationFn: ({ email, otp, password, confirmPassword }: RegisterFormValues) =>
      authService.register({ email, otp, password, confirmPassword }),
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
  const handleApiError = useFormApiError(form);

  const mutation = useMutation({
    mutationFn: (values: ResetPasswordFormValues) => authService.resetPassword(values),
    onSuccess: () => setDone(true),
    onError: handleApiError,
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return { form, onSubmit, isSubmitting: mutation.isPending, done };
}

export function useLogout() {
  const navigate = useNavigate();
  const { logout } = useAuthContext();
  const { message } = App.useApp();

  return useCallback(async () => {
    await logout();
    message.success('Đã đăng xuất');
    void navigate({ to: PATHS.login });
  }, [logout, message, navigate]);
}
