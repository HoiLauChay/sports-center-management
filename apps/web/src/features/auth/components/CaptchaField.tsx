import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { config } from '~/lib/config';

export interface CaptchaHandle {
  reset: () => void;
}

interface CaptchaFieldProps {
  onToken: (token: string | null) => void;
}

export const CaptchaField = forwardRef<CaptchaHandle, CaptchaFieldProps>(function CaptchaField({ onToken }, ref) {
  const turnstileRef = useRef<TurnstileInstance | null>(null);

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (!config.turnstileSiteKey) return;
      turnstileRef.current?.reset();
      onToken(null);
    },
  }));

  if (!config.turnstileSiteKey) return null;

  return (
    <div className="mb-4">
      <Turnstile
        ref={turnstileRef}
        siteKey={config.turnstileSiteKey}
        options={{ theme: 'light', language: 'vi', size: 'flexible' }}
        onSuccess={onToken}
        onExpire={() => onToken(null)}
        onError={() => onToken(null)}
      />
    </div>
  );
});
