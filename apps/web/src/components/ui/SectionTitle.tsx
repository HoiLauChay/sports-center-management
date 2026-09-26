import type { ReactNode } from 'react';
import './section-title.css';

interface SectionTitleProps {
  children: ReactNode;
  className?: string;
}

export function SectionTitle({ children, className }: SectionTitleProps) {
  return <h3 className={className ? `sc-section-title ${className}` : 'sc-section-title'}>{children}</h3>;
}
