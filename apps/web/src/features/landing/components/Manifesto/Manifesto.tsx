import { motion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { useRef } from 'react';
import poolImg from '~/assets/images/sports/swim.jpg';
import { MANIFESTO } from '../../data/content';
import './manifesto.css';

/** Paragraph whose words brighten one by one as the user scrolls through it. */
export function Manifesto() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.45'] });
  const words = MANIFESTO.split(' ');

  const imageClip = useTransform(scrollYProgress, [0, 0.6], ['inset(100% 0 0 0)', 'inset(0% 0 0 0)']);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1.2, 1]);

  return (
    <section className="lp-manifesto">
      <div className="lp-container lp-manifesto-grid" ref={ref}>
        <p className="lp-manifesto-text">
          {words.map((word, i) => (
            <FadingWord key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
              {word}
            </FadingWord>
          ))}
        </p>

        <motion.figure className="lp-manifesto-fig" style={{ clipPath: imageClip }}>
          <motion.img src={poolImg} alt="Hồ bơi" style={{ scale: imageScale }} />
          <figcaption>Hồ bơi · tầng hầm · 06:00 – 21:00</figcaption>
        </motion.figure>
      </div>
    </section>
  );
}

interface FadingWordProps {
  children: string;
  progress: MotionValue<number>;
  range: [number, number];
}

function FadingWord({ children, progress, range }: FadingWordProps) {
  const opacity = useTransform(progress, range, [0.15, 1]);
  return (
    <span className="lp-manifesto-word">
      <motion.span style={{ opacity }}>{children}</motion.span>{' '}
    </span>
  );
}
