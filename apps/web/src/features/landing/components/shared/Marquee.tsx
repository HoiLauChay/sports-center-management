import type { ReactNode } from 'react';

interface MarqueeProps {
  children: ReactNode;
  speed?: number;
  reverse?: boolean;
  className?: string;
}

export function Marquee({ children, speed = 40, reverse = false, className = '' }: MarqueeProps) {
  return (
    <div className={`lp-marquee ${className}`}>
      <div
        className="lp-marquee-track"
        style={{ animationDuration: `${speed}s`, animationDirection: reverse ? 'reverse' : 'normal' }}
      >
        <div className="lp-marquee-group">{children}</div>
        <div className="lp-marquee-group" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
