import { Check } from 'lucide-react';
import type { Benefit } from '../../data/content';

/** Stat + description + checklist of one benefit; shown in the side panel (desktop) or under its row (mobile). */
export function BenefitDetail({ benefit }: { benefit: Benefit }) {
  return (
    <>
      <div className="lp-perk-stat">
        <b>{benefit.stat}</b>
        <span>{benefit.statLabel}</span>
      </div>
      <p>{benefit.desc}</p>
      <ul>
        {benefit.items.map((item) => (
          <li key={item}>
            <Check size={16} strokeWidth={2.6} />
            {item}
          </li>
        ))}
      </ul>
    </>
  );
}
