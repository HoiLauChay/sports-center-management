import { AUTH_RULES } from '@sports-center/shared';
import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';

const LENGTH = AUTH_RULES.OTP_LENGTH;

interface OtpBoxesProps {
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  invalid?: boolean;
  disabled?: boolean;
}

export function OtpBoxes({ onChange, onComplete, invalid = false, disabled = false }: OtpBoxesProps) {
  const [digits, setDigits] = useState<string[]>(() => Array.from({ length: LENGTH }, () => ''));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const commit = (next: string[], focusIndex: number) => {
    setDigits(next);
    const code = next.join('');
    onChange(code);
    refs.current[Math.min(Math.max(focusIndex, 0), LENGTH - 1)]?.focus();
    if (next.every(Boolean)) onComplete?.(code);
  };

  const fillFrom = (index: number, text: string) => {
    const clean = text.replace(/\D/g, '').slice(0, LENGTH - index);
    if (!clean) return;
    const next = [...digits];
    [...clean].forEach((digit, offset) => {
      next[index + offset] = digit;
    });
    commit(next, index + clean.length);
  };

  const onInput = (index: number, text: string) => {
    const clean = text.replace(/\D/g, '');
    if (!clean) {
      const next = [...digits];
      next[index] = '';
      commit(next, index);
      return;
    }
    const current = digits[index];
    fillFrom(index, current && clean.length === 2 && clean.startsWith(current) ? clean.slice(1) : clean);
  };

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = '';
      commit(next, index - 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      refs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      refs.current[index + 1]?.focus();
    }
  };

  const onPaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    fillFrom(index, event.clipboardData.getData('text'));
  };

  return (
    <div className="grid grid-cols-6 gap-2 sm:gap-3" role="group" aria-label="Mã xác nhận gồm 6 chữ số">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          value={digit}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          autoFocus={index === 0}
          disabled={disabled}
          aria-label={`Chữ số ${index + 1}`}
          aria-invalid={invalid}
          onChange={(event) => onInput(index, event.target.value)}
          onKeyDown={(event) => onKeyDown(index, event)}
          onPaste={(event) => onPaste(index, event)}
          onFocus={(event) => event.target.select()}
          className={`h-14 w-full min-w-0 rounded-lg border bg-white text-center font-display text-[26px] font-bold text-sc-ink outline-none transition-colors focus:border-sc-primary focus:ring-2 focus:ring-sc-primary/15 disabled:bg-sc-paper sm:h-16 ${
            invalid ? 'border-sc-error' : 'border-sc-border'
          }`}
        />
      ))}
    </div>
  );
}
