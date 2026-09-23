import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import { PATHS } from '~/constants/paths';
import { BENEFITS, BENEFITS_SECTION } from '../../data/content';
import { Reveal, SplitWords } from '../shared';
import { BenefitCard } from './BenefitCard';
import './benefits.css';
import { useTrackDistance } from './useTrackDistance';

/**
 * Pinned horizontal scroll (desktop): vertical scroll progress is mapped to translateX of the track.
 * On tablet/mobile the CSS disables the pin and stacks cards vertically.
 */
export function Benefits() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const distance = useTrackDistance(trackRef);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] });
  const trackX = useTransform(scrollYProgress, [0, 1], [0, -distance]);
  const backgroundX = useTransform(scrollYProgress, [0, 1], ['10%', '-60%']);
  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  const { endCard } = BENEFITS_SECTION;

  return (
    <section ref={sectionRef} className="lp-roles" id="benefits">
      <div className="lp-roles-sticky">
        <div className="lp-grain" />
        <motion.div className="lp-roles-bg" style={{ x: backgroundX }} aria-hidden>
          {BENEFITS_SECTION.backgroundText}
        </motion.div>

        <div className="lp-container lp-roles-head">
          <Reveal>
            <span className="lp-eyebrow light">{BENEFITS_SECTION.eyebrow}</span>
          </Reveal>
          <SplitWords
            as="h2"
            onView
            className="lp-h2 light"
            text={BENEFITS_SECTION.title}
            emphasis={BENEFITS_SECTION.emphasis}
          />
          <div className="lp-roles-progress">
            <motion.i style={{ width: progressWidth }} />
          </div>
        </div>

        <motion.div ref={trackRef} className="lp-roles-track" style={{ x: trackX }}>
          {BENEFITS.map((benefit, i) => (
            <BenefitCard key={benefit.key} benefit={benefit} index={i} />
          ))}

          <div className="lp-role lp-role-end">
            <h3>{endCard.title}</h3>
            <p>{endCard.desc}</p>
            <Link to={PATHS.register} className="lp-btn lp-btn-ink">
              {endCard.cta} <ArrowRight size={16} />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
