import { zodResolver } from '@hookform/resolvers/zod';
import { AUTH_RULES, ERROR_CODE, loginStartBodySchema } from '@sports-center/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useFormApiError } from '~/hooks/useFormApiError';
import { toApiError } from '~/lib/http-errors';
import type { NewPasswordValues } from '../components/NewPasswordStep';
import { authService } from '../services/auth.service';
import { AUTH_ERROR_FIELDS } from '../utils/authErrorFields';

export type ResetStep =
  | { kind: 'email' }
  | { kind: 'otp'; email: string; countdown: number }
  | { kind: 'password'; email: string; otp: string }
  | { kind: 'done' };

export function usePasswordResetFlow(defaultEmail = '') {
  const [step, setStep] = useState<ResetStep>({ kind: 'email' });
  const [resetError, setResetError] = useState<string | null>(null);

  const emailForm = useForm<{ email: string }>({
    resolver: zodResolver(loginStartBodySchema),
    mode: 'onTouched',
    defaultValues: { email: defaultEmail },
  });
  const onEmailError = useFormApiError(emailForm, AUTH_ERROR_FIELDS);

  const send = useMutation({
    mutationFn: ({ email, captchaToken }: { email: string; captchaToken: string }) =>
      authService.sendOtp({ email, purpose: 'PASSWORD_RESET', captchaToken }),
    onSuccess: (_, { email }) => setStep({ kind: 'otp', email, countdown: AUTH_RULES.OTP_RESEND_COOLDOWN }),
    onError: (error, { email }) => {
      const apiError = toApiError(error);
      if (apiError.code === ERROR_CODE.OTP_COOLDOWN && apiError.retryAfter) {
        setStep({ kind: 'otp', email, countdown: apiError.retryAfter });
        return;
      }
      onEmailError(error);
    },
  });

  const reset = useMutation({
    mutationFn: ({ email, otp, ...values }: NewPasswordValues & { email: string; otp: string }) =>
      authService.resetPassword({ email, otp, ...values }),
    onSuccess: () => setStep({ kind: 'done' }),
    onError: (error) => setResetError(toApiError(error).message),
  });

  const resend = async (email: string, captchaToken: string) => {
    await authService.sendOtp({ email, purpose: 'PASSWORD_RESET', captchaToken });
    return AUTH_RULES.OTP_RESEND_COOLDOWN;
  };

  return {
    step,
    setStep,
    emailForm,
    submitEmail: (captchaToken: string) => emailForm.handleSubmit(({ email }) => send.mutate({ email, captchaToken })),
    submitNewPassword: (values: NewPasswordValues) => {
      if (step.kind !== 'password') return;
      setResetError(null);
      reset.mutate({ ...values, email: step.email, otp: step.otp });
    },
    resend,
    sending: send.isPending,
    resetting: reset.isPending,
    resetError,
  };
}
