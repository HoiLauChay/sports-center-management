import { useMutation } from '@tanstack/react-query';
import { App } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError } from '~/lib/http-errors';
import { authService } from '../services/auth.service';
import type { OtpPurpose } from '../types';

export const OTP_RESEND_COOLDOWN = 60;

interface UseSendOtpOptions {
  purpose: OtpPurpose;
  onEmailError?: (message: string) => void;
  onSent?: () => void;
}

export function useSendOtp({ purpose, onEmailError, onSent }: UseSendOtpOptions) {
  const { message } = App.useApp();
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<number | null>(null);

  const startCountdown = useCallback((seconds: number) => {
    setCountdown(seconds);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setCountdown((s) => {
        if (s <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    },
    [],
  );

  const mutation = useMutation({
    mutationFn: (payload: { email: string; captchaToken: string }) => authService.sendOtp({ ...payload, purpose }),
    onSuccess: (msg) => {
      message.success(msg);
      startCountdown(OTP_RESEND_COOLDOWN);
      onSent?.();
    },
    onError: (err) => {
      const apiError = toApiError(err);
      if (apiError.code === 'EMAIL_TAKEN') {
        onEmailError?.(apiError.message);
        return;
      }
      if (apiError.code === 'OTP_COOLDOWN') {
        const wait = Number(/(\d+)/.exec(apiError.message)?.[1]);
        if (wait > 0) startCountdown(wait);
      }
      message.error(apiError.message);
    },
  });

  return { send: mutation.mutate, isSending: mutation.isPending, countdown };
}
