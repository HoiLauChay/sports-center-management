import { animate, useInView } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { EASE } from './motion';

interface CounterProps {
  to: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  decimals?: number;
}

export function Counter({ to, prefix = '', suffix = '', duration = 1.8, decimals = 0 }: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, { duration, ease: EASE, onUpdate: setValue });
    return () => controls.stop();
  }, [inView, to, duration]);

  const formatted = value.toLocaleString('vi-VN', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });

  return (
    <span ref={ref}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
