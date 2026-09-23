import type { Benefit } from '../../data/content';

interface BenefitCardProps {
  benefit: Benefit;
  index: number;
}

export function BenefitCard({ benefit, index }: BenefitCardProps) {
  return (
    <div className="lp-role">
      <div className="lp-role-top">
        <span className="lp-role-tag">{benefit.tag}</span>
        <span className="lp-role-idx">0{index + 1}</span>
      </div>
      <h3>{benefit.title}</h3>
      <p>{benefit.desc}</p>
      <ul>
        {benefit.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
