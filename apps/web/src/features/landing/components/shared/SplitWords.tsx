import { motion, useReducedMotion, type Variants } from 'motion/react';
import { Fragment } from 'react';
import { EASE } from './motion';

const wordVariants: Variants = {
  hidden: { y: '110%' },
  show: { y: '0%', transition: { duration: 0.9, ease: EASE } },
};

interface SplitWordsProps {
  text: string;
  className?: string;
  delay?: number;
  as?: 'h1' | 'h2' | 'p';
  onView?: boolean;
  emphasis?: string;
}

/** Heading that reveals word by word (each word slides up from behind a mask). */
export function SplitWords({ text, className, delay = 0, as: Tag = 'h1', onView = false, emphasis }: SplitWordsProps) {
  const reduceMotion = useReducedMotion();
  const MotionTag = motion[Tag];
  const words = text.split(' ');

  const emphasisStart = emphasis ? text.indexOf(emphasis) : -1;
  const emphasisEnd = emphasisStart + (emphasis?.length ?? 0);
  // Character offset of each word, used to detect words inside the `emphasis` substring
  const wordStarts = words.map((_, i) => words.slice(0, i).join(' ').length + (i > 0 ? 1 : 0));

  const trigger = onView ? { whileInView: 'show', viewport: { once: true, amount: 0.6 } } : { animate: 'show' };

  return (
    <MotionTag
      className={className}
      initial={reduceMotion ? false : 'hidden'}
      {...trigger}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: delay } } }}
      aria-label={text}
    >
      {words.map((word, i) => {
        const isEmphasis = emphasisStart >= 0 && wordStarts[i] >= emphasisStart && wordStarts[i] < emphasisEnd;
        return (
          <Fragment key={i}>
            <span className="lp-word" aria-hidden>
              <motion.span
                className={isEmphasis ? 'lp-em' : undefined}
                style={{ display: 'inline-block' }}
                variants={wordVariants}
              >
                {word}
              </motion.span>
            </span>{' '}
          </Fragment>
        );
      })}
    </MotionTag>
  );
}
