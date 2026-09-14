import { useEffect, useState } from 'react';

/** Returns the "#id" of the section currently crossing the vertical center of the viewport. */
export function useActiveSection(sectionIds: string[]): string {
  const [active, setActive] = useState('');

  useEffect(() => {
    const elements = sectionIds.map((id) => document.querySelector(id)).filter((el): el is Element => el !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(`#${entry.target.id}`);
        });
      },
      // Shrink the observed area to a thin band around the viewport center
      { rootMargin: '-45% 0px -50% 0px' },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sectionIds]);

  return active;
}
