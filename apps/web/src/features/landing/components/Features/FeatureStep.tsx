import { motion, useInView } from 'motion/react';
import { useEffect, useRef } from 'react';
import type { FeatureStep as FeatureStepData } from '../../data/content';
import { EASE } from '../shared';
import { FeatureVisual } from './visuals';

interface FeatureStepProps {
  step: FeatureStepData;
  index: number;
  active: boolean;
  onActivate: (index: number) => void;
}

export function FeatureStep({ step, index, active, onActivate }: FeatureStepProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: '-45% 0px -45% 0px' });

  useEffect(() => {
    if (inView) onActivate(index);
  }, [inView, index, onActivate]);

  return (
    <div ref={ref} className={`lp-feat-step ${active ? 'on' : ''}`}>
      <motion.div
        className="lp-feat-num"
        animate={{ x: active ? 0 : -6, opacity: active ? 1 : 0.35 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        0{index + 1}
      </motion.div>
      <h3>{step.title}</h3>
      <p>{step.desc}</p>
      <ul>
        {step.bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
      <div className="lp-feat-inline">
        <FeatureVisual feature={step.key} />
      </div>
    </div>
  );
}
