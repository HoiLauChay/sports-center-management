import { useMutation } from '@tanstack/react-query';
import { Button } from 'antd';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { toApiError } from '~/lib/http-errors';
import { authService } from '../services/auth.service';
import { AuthHeading } from './AuthShell';
import { OtpBoxes } from './OtpBoxes';

function useSecondsLeft(initial: number) {
  const [left, setLeft] = useState(initial);
  useEffect(() => {
    if (left <= 0) return;
    const timer = window.setTimeout(() => setLeft((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [left]);
  return [left, setLeft] as const;
}

interface OtpStepProps {
  email: string;
  purpose: 'PASSWORD_RESET' | 'ACCOUNT_SETUP';
  initialCountdown: number;
  onBack: () => void;
  onVerified: (otp: string) => void;
  onResend: () => Promise<number>;
  resendReady?: boolean;
  beforeResend?: ReactNode;
  footer?: ReactNode;
}

export function OtpStep({
  email,
  purpose,
  initialCountdown,
  onBack,
  onVerified,
  onResend,
  resendReady = true,
  beforeResend,
  footer,
}: OtpStepProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [boxesKey, setBoxesKey] = useState(0);
  const [secondsLeft, setSecondsLeft] = useSecondsLeft(initialCountdown);

  const verify = useMutation({
    mutationFn: (otp: string) => authService.verifyOtp({ email, purpose, otp }),
    onSuccess: (_, otp) => onVerified(otp),
    onError: (err) => setError(toApiError(err).message),
  });

  const resend = useMutation({
    mutationFn: onResend,
    onSuccess: (seconds) => {
      setSecondsLeft(seconds);
      setCode('');
      setError(null);
      setBoxesKey((key) => key + 1);
    },
    onError: (err) => setError(toApiError(err).message),
  });

  const submit = (otp: string) => {
    if (otp.length !== 6 || verify.isPending) return;
    setError(null);
    verify.mutate(otp);
  };

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-[16px] font-semibold text-sc-ink hover:text-sc-primary"
      >
        <ArrowLeft size={20} />
        Quay lại
      </button>
      <AuthHeading
        title="Nhập mã xác nhận"
        description={
          <>
            Chúng tôi đã gửi mã 6 số tới email <b className="break-all text-sc-primary">{email}</b>
          </>
        }
      />

      <OtpBoxes
        key={boxesKey}
        invalid={Boolean(error)}
        disabled={verify.isPending}
        onChange={(value) => {
          setCode(value);
          if (error) setError(null);
        }}
        onComplete={submit}
      />
      {error && <div className="mt-2 text-[14.5px] text-sc-error">{error}</div>}

      <Button
        type="primary"
        block
        className="!mt-6"
        loading={verify.isPending}
        disabled={code.length !== 6}
        onClick={() => submit(code)}
        icon={<ChevronRight size={18} />}
        iconPlacement="end"
      >
        Tiếp tục
      </Button>

      <div className="mt-4 flex flex-col items-center gap-2 text-center text-[15px] text-sc-muted">
        {secondsLeft > 0 ? (
          <span>
            Gửi lại mã sau <b className="text-sc-primary tabular-nums">{secondsLeft}s</b>
          </span>
        ) : (
          <>
            {beforeResend}
            <Button
              type="link"
              className="!h-auto !p-0 font-semibold"
              loading={resend.isPending}
              disabled={!resendReady}
              onClick={() => resend.mutate()}
            >
              Gửi lại mã
            </Button>
          </>
        )}
      </div>

      {footer && <div className="mt-6 border-t border-sc-border-soft pt-5 text-[15px] text-sc-muted">{footer}</div>}
    </>
  );
}
