import type { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { EASE } from '../../shared';

interface VisHeadProps {
  icon: LucideIcon;
  title: ReactNode;
  sub?: ReactNode;
  extra?: ReactNode;
}

/** Card header shared by every feature visual: icon tile, title + subline, optional chip on the right. */
export function VisHead({ icon: Icon, title, sub, extra }: VisHeadProps) {
  return (
    <div className="lp-vis-head">
      <span className="lp-vis-icon">
        <Icon size={17} strokeWidth={2.2} />
      </span>
      <div className="lp-vis-title">
        <b>{title}</b>
        {sub && <small>{sub}</small>}
      </div>
      {extra}
    </div>
  );
}

interface VisFloatProps {
  delay?: number;
  children: ReactNode;
}

/** Small card hanging off the top-right corner of the main visual, to give the panel some depth. */
export function VisFloat({ delay = 0.8, children }: VisFloatProps) {
  return (
    <motion.div
      className="lp-float"
      initial={{ opacity: 0, y: -12, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.6, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
