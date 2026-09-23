import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { FEATURE_STEPS, FEATURES_SECTION } from '../../data/content';
import { EASE, SectionHeading } from '../shared';
import './features.css';
import { FeatureStep } from './FeatureStep';
import { FeatureVisual } from './visuals';

/**
 * Scrollytelling: steps on the left scroll past a sticky panel on the right
 * that swaps its visual to match the active step. On mobile each step renders its visual inline.
 */
export function Features() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeStep = FEATURE_STEPS[activeIndex];
  const railProgress = (activeIndex / (FEATURE_STEPS.length - 1)) * 100;

  return (
    <section className="lp-section lp-features" id="features">
      <div className="lp-container">
        <SectionHeading
          eyebrow={FEATURES_SECTION.eyebrow}
          title={FEATURES_SECTION.title}
          emphasis={FEATURES_SECTION.emphasis}
          sub={FEATURES_SECTION.sub}
        />

        <div className="lp-feat-layout">
          <div className="lp-feat-steps">
            <div className="lp-feat-rail">
              <motion.i animate={{ top: `${railProgress}%` }} transition={{ duration: 0.6, ease: EASE }} />
            </div>
            {FEATURE_STEPS.map((step, i) => (
              <FeatureStep
                key={step.key}
                step={step}
                index={i}
                active={activeIndex === i}
                onActivate={setActiveIndex}
              />
            ))}
          </div>

          <div className="lp-feat-sticky">
            <div className="lp-feat-panel">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep.key}
                  className="lp-feat-visual"
                  initial={{ opacity: 0, y: 40, scale: 0.96, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -30, scale: 0.98, filter: 'blur(6px)' }}
                  transition={{ duration: 0.5, ease: EASE }}
                >
                  <FeatureVisual feature={activeStep.key} />
                </motion.div>
              </AnimatePresence>
              <div className="lp-feat-dots">
                {FEATURE_STEPS.map((step, i) => (
                  <i key={step.key} className={i === activeIndex ? 'on' : ''} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
