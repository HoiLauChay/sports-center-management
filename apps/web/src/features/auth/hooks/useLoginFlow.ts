import { zodResolver } from '@hookform/resolvers/zod';
import { AUTH_RULES, loginBodySchema, loginStartBodySchema, type LoginBody } from '@sports-center/shared';
import { useMutation } from '@tanstack/react-query';
import { App } from 'antd';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useFormApiError } from '~/hooks/useFormApiError';
import { toApiError } from '~/lib/http-errors';
import type { NewPasswordValues } from '../components/NewPasswordStep';
import { authService } from '../services/auth.service';
import { AUTH_ERROR_FIELDS } from '../utils/authErrorFields';
import { useCompleteAuth } from './useAuth';

export type LoginStep =
  | { kind: 'email' }
  | { kind: 'password'; email: string }
  | { kind: 'otp'; email: string; countdown: number }
  | { kind: 'set'; email: string; otp: string };

export function useLoginFlow() {
  const { message } = App.useApp();
  const completeAuth = useCompleteAuth();
  const [step, setStep] = useState<LoginStep>({ kind: 'email' });
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);

  const emailForm = useForm<{ email: string }>({
    resolver: zodResolver(loginStartBodySchema),
    mode: 'onTouched',
    defaultValues: { email: '' },
  });
  const passwordForm = useForm<LoginBody>({
    resolver: zodResolver(loginBodySchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });
  const onEmailError = useFormApiError(emailForm, AUTH_ERROR_FIELDS);
  const onPasswordError = useFormApiError(passwordForm, AUTH_ERROR_FIELDS);

  const start = useMutation({
    mutationFn: ({ email }: { email: string }) => authService.loginStart(email),
    onSuccess: (result, { email }) => {
      if (result.next === 'PASSWORD') {
        passwordForm.reset({ email, password: '' });
        setStep({ kind: 'password', email });
        return;
      }
      setStep({ kind: 'otp', email, countdown: result.retryAfter ?? AUTH_RULES.OTP_RESEND_COOLDOWN });
    },
    onError: onEmailError,
  });

  const login = useMutation({
    mutationFn: (values: LoginBody) => authService.login(values),
    onSuccess: (user) => {
      message.success('Đăng nhập thành công');
      completeAuth(user);
    },
    onError: onPasswordError,
  });

  const setPassword = useMutation({
    mutationFn: ({ email, otp, ...values }: NewPasswordValues & { email: string; otp: string }) =>
      authService.setPassword({ email, otp, ...values }),
    onSuccess: (user) => {
      message.success('Đặt mật khẩu thành công');
      completeAuth(user);
    },
    onError: (error) => setNewPasswordError(toApiError(error).message),
  });

  const resend = async (email: string) => {
    const result = await authService.loginStart(email);
    return result.retryAfter ?? AUTH_RULES.OTP_RESEND_COOLDOWN;
  };

  return {
    step,
    setStep,
    emailForm,
    passwordForm,
    submitEmail: emailForm.handleSubmit((values) => start.mutate(values)),
    submitPassword: passwordForm.handleSubmit((values) => login.mutate(values)),
    submitNewPassword: (values: NewPasswordValues) => {
      if (step.kind !== 'set') return;
      setNewPasswordError(null);
      setPassword.mutate({ ...values, email: step.email, otp: step.otp });
    },
    resend,
    starting: start.isPending,
    loggingIn: login.isPending,
    settingPassword: setPassword.isPending,
    newPasswordError,
  };
}
