import dayjs from 'dayjs';
import { motion } from 'motion/react';
import { HERO } from '../../data/content';

export function HeroFacts() {
  const promoFact = { title: `${HERO.promo.titlePrefix} ${dayjs().format('M')}`, desc: HERO.promo.desc };
  const facts = [...HERO.facts, promoFact];

  return (
    <motion.div
      className="lp-hero-facts"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, delay: 1.1 }}
    >
      <div className="lp-container">
        {facts.map((fact) => (
          <div key={fact.title} className="lp-fact">
            <b>{fact.title}</b>
            {fact.desc}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
