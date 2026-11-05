import { Link } from '@tanstack/react-router';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { PATHS } from '~/constants/paths';
import { BENEFITS, BENEFITS_SECTION } from '../../data/content';
import { EASE, Reveal, SplitWords } from '../shared';
import { BenefitDetail } from './BenefitDetail';
import './benefits.css';

/**
 * Editorial index: big numbered rows on the left; the hovered/selected one drives the detail panel on the right.
 * On tablet/mobile the panel is hidden and the detail opens under the active row instead.
 */
export function Benefits() {
  const [active, setActive] = useState(0);
  const current = BENEFITS[active];
  const { endCard } = BENEFITS_SECTION;

  return (
    <section className="lp-section lp-perks" id="benefits">
      <div className="lp-grain" />
      <div className="lp-container">
        <div className="lp-perks-head">
          <div>
            <Reveal className="lp-perks-eyebrow">
              <span className="lp-eyebrow light">{BENEFITS_SECTION.eyebrow}</span>
              <span className="lp-hint">
                <button
                  type="button"
                  className="lp-hint-btn"
                  aria-label="Thông tin thêm"
                  aria-describedby="benefits-info"
                >
                  i
                </button>
                <span role="tooltip" id="benefits-info" className="lp-hint-tip">
                  {BENEFITS_SECTION.sub}
                </span>
              </span>
            </Reveal>
            <SplitWords
              as="h2"
              onView
              className="lp-h2 light"
              text={BENEFITS_SECTION.title}
              emphasis={BENEFITS_SECTION.emphasis}
            />
          </div>
        </div>

        <div className="lp-perks-body">
          <ol className="lp-perks-list">
            {BENEFITS.map((benefit, i) => (
              <li key={benefit.key} className={i === active ? 'is-active' : undefined}>
                <button
                  type="button"
                  className="lp-perk-row"
                  aria-expanded={i === active}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                >
                  <span className="lp-perk-idx">0{i + 1}</span>
                  <span className="lp-perk-main">
                    <span className="lp-perk-tag">{benefit.tag}</span>
                    <span className="lp-perk-title">{benefit.title}</span>
                  </span>
                  <ArrowUpRight className="lp-perk-arrow" size={28} />
                </button>
                <div className="lp-perk-inline">
                  <BenefitDetail benefit={benefit} />
                </div>
              </li>
            ))}
          </ol>

          <div className="lp-perks-panel" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.key}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4, ease: EASE }}
              >
                <BenefitDetail benefit={current} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <Reveal className="lp-perks-end">
          <div>
            <h3>{endCard.title}</h3>
            <p>{endCard.desc}</p>
          </div>
          <Link to={PATHS.register} className="lp-btn lp-btn-ink lg">
            {endCard.cta} <ArrowRight size={18} />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
