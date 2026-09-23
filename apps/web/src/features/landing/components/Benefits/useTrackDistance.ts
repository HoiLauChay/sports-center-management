import { useEffect, useState, type RefObject } from 'react';

/** Distance (px) the horizontal track must travel to reveal all of its content. */
export function useTrackDistance(trackRef: RefObject<HTMLElement | null>): number {
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const measure = () => {
      const track = trackRef.current;
      if (track) setDistance(Math.max(0, track.scrollWidth - track.clientWidth));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [trackRef]);

  return distance;
}
