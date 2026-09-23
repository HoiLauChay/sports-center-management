import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { motion, useScroll, useTransform } from 'motion/react';
import heroImg from '~/assets/images/hero-gym.jpg';
import { PATHS } from '~/constants/paths';
import { HERO } from '../../data/content';
import { EASE, SplitWords } from '../shared';
import './hero.css';
import { HeroFacts } from './HeroFacts';
import { usePinToBottom } from './usePinToBottom';

/** Full-screen hero. Scroll-driven: image parallax, text fades, whole block scales down and dims. */
export function Hero() {
  const ref = usePinToBottom();

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });

  const imgY = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const textY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.92]);
  const heroRadius = useTransform(scrollYProgress, [0, 1], [0, 32]);
  const heroDim = useTransform(scrollYProgress, [0, 1], [0, 0.55]);

  return (
    <motion.section ref={ref} className="lp-hero" style={{ scale: heroScale, borderRadius: heroRadius }}>
      <motion.img
        className="lp-hero-img"
        src={heroImg}
        alt=""
        style={{ y: imgY }}
        initial={{ scale: 1.12 }}
        animate={{ scale: 1 }}
        transition={{ duration: 2.2, ease: EASE }}
      />
      <div className="lp-hero-shade" />
      <div className="lp-grain" />
      <motion.div className="lp-hero-dim" style={{ opacity: heroDim }} />

      <motion.div className="lp-container lp-hero-content" style={{ y: textY, opacity: textOpacity }}>
        <motion.p
          className="lp-kicker"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <i /> {HERO.kicker}
        </motion.p>

        <SplitWords className="lp-h1" text={HERO.title} delay={0.15} />

        <motion.p
          className="lp-lead"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7, ease: EASE }}
        >
          {HERO.lead}
        </motion.p>

        <motion.div
          className="lp-hero-actions"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.85, ease: EASE }}
        >
          <Link to={PATHS.register} className="lp-btn lp-btn-primary lg">
            Đăng ký tập thử miễn phí <ArrowRight size={18} />
          </Link>
          <Link to={PATHS.login} className="lp-btn lp-btn-ghost light lg">
            Đặt sân
          </Link>
        </motion.div>
      </motion.div>

      <HeroFacts />
    </motion.section>
  );
}
