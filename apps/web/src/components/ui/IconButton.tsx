import type { ButtonHTMLAttributes } from 'react';

export function IconButton({ className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      {...props}
      className={`relative inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-sc-border bg-white text-sc-ink-2 [transition:all_0.15s] hover:border-sc-primary-border hover:bg-sc-primary-soft hover:text-sc-primary${className ? ` ${className}` : ''}`}
    />
  );
}
