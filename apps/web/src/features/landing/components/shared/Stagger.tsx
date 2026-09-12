import { motion } from 'motion/react';
import type { CSSProperties, ReactNode } from 'react';
import { staggerContainer, staggerItem } from './motion';

interface BaseProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Stagger({ children, className, style, amount = 0.2 }: BaseProps & { amount?: number }) {
  return (
    <motion.div
      className={className}
      style={style}
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className, style }: BaseProps) {
  return (
    <motion.div className={className} style={style} variants={staggerItem}>
      {children}
    </motion.div>
  );
}
