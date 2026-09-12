import Lenis from 'lenis';
import { useEffect } from 'react';

const NAV_HEIGHT = 72;

/** Lenis smooth scroll, scoped to the landing page (destroyed on unmount). */
export function useSmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.09, anchors: { offset: -NAV_HEIGHT }, autoRaf: true });
    document.documentElement.classList.add('lp-html');

    return () => {
      lenis.destroy();
      document.documentElement.classList.remove('lp-html');
    };
  }, []);
}
