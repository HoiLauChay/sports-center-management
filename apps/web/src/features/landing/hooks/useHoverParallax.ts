import { useMotionValue, useSpring } from 'motion/react';
import type { MouseEvent } from 'react';

const SPRING = { stiffness: 120, damping: 18 };

/** Shifts an element slightly toward the cursor on hover (parallax). */
export function useHoverParallax(maxOffset = 10) {
  const x = useSpring(useMotionValue(0), SPRING);
  const y = useSpring(useMotionValue(0), SPRING);

  const onMouseMove = (e: MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set(((e.clientX - rect.left) / rect.width - 0.5) * -maxOffset);
    y.set(((e.clientY - rect.top) / rect.height - 0.5) * -maxOffset);
  };

  const onMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return { x, y, onMouseMove, onMouseLeave };
}
