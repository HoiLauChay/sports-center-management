import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import ctaImg from '~/assets/images/sports/tennis.jpg';
import { PATHS } from '~/constants/paths';
import { CTA } from '../../data/content';
import { Reveal, SplitWords } from '../shared';
import './cta.css';

export function Cta() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] });

  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);
  const radius = useTransform(scrollYProgress, [0, 1], [24, 0]);
  const imageY = useTransform(scrollYProgress, [0, 1], ['-8%', '0%']);

  return (
    <section ref={ref} className="lp-cta-wrap">
      <motion.div className="lp-cta" style={{ scale, borderRadius: radius }}>
        <motion.img className="lp-cta-img" src={ctaImg} alt="" style={{ y: imageY }} />
        <div className="lp-grain" />

        <div className="lp-container">
          <SplitWords as="h2" onView className="lp-cta-title" text={CTA.title} emphasis={CTA.emphasis} />
          <Reveal delay={0.1}>
            <p className="lp-lead">{CTA.lead}</p>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="lp-hero-actions">
              <Link to={PATHS.login} className="lp-btn lp-btn-primary lg">
                Đặt sân <ArrowRight size={18} />
              </Link>
              <Link to={PATHS.register} className="lp-btn lp-btn-ghost light lg">
                Đăng ký thành viên
              </Link>
            </div>
          </Reveal>
        </div>
      </motion.div>
    </section>
  );
}
