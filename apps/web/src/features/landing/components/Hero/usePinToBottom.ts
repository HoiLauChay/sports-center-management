import { useEffect, useRef } from 'react';

/**
 * The hero is sticky-pinned while the next section scrolls over it.
 * When the hero is taller than the viewport, pin its BOTTOM edge instead of the top
 * so the lower part stays reachable. Returns the ref to attach to the hero element.
 */
export function usePinToBottom() {
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    const pin = hero?.parentElement;
    if (!hero || !pin) return;

    const fit = () => {
      pin.style.top = `${Math.min(0, window.innerHeight - hero.offsetHeight)}px`;
    };
    fit();

    const observer = new ResizeObserver(fit);
    observer.observe(hero);
    window.addEventListener('resize', fit);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, []);

  return heroRef;
}
