import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import { SHOWCASE } from '../../data/content';
import { Reveal, SplitWords } from '../shared';
import { AppMockup } from './AppMockup';
import './showcase.css';

export function Showcase() {
  const stageRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: stageRef, offset: ['start end', 'center center'] });

  const rotateX = useTransform(scrollYProgress, [0, 1], [24, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.9, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.4], [0, 1]);

  return (
    <section className="lp-showcase">
      <div className="lp-grain" />

      <div className="lp-container lp-showcase-head">
        <div>
          <Reveal>
            <span className="lp-eyebrow light">{SHOWCASE.eyebrow}</span>
          </Reveal>
          <SplitWords as="h2" onView className="lp-h2 light" text={SHOWCASE.title} emphasis={SHOWCASE.emphasis} />
        </div>
        <Reveal delay={0.1}>
          <p>{SHOWCASE.desc}</p>
          <div className="lp-showcase-points">
            {SHOWCASE.points.map((point) => (
              <span key={point}>{point}</span>
            ))}
          </div>
        </Reveal>
      </div>

      <div ref={stageRef} className="lp-showcase-stage">
        <motion.div className="lp-mock-wrap" style={{ rotateX, scale, opacity }}>
          <AppMockup />
        </motion.div>
      </div>
    </section>
  );
}
