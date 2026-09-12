import { Link } from '@tanstack/react-router';
import { PATHS } from '~/constants/paths';
import { PRICING_SECTION } from '../../data/content';
import { FEATURED_PLANS, OTHER_PLANS_COUNT, OTHER_PLANS_HINT } from '../../data/plans';
import { Reveal, SectionHeading, Stagger, StaggerItem } from '../shared';
import { PlanCard } from './PlanCard';
import './pricing.css';

export function Pricing() {
  return (
    <section className="lp-section" id="pricing">
      <div className="lp-container">
        <SectionHeading
          eyebrow={PRICING_SECTION.eyebrow}
          title={PRICING_SECTION.title}
          emphasis={PRICING_SECTION.emphasis}
          sub={PRICING_SECTION.sub}
        />

        <Stagger className="lp-pricing">
          {FEATURED_PLANS.map((plan) => (
            <StaggerItem key={plan.id}>
              <PlanCard plan={plan} />
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.2}>
          <p className="lp-pricing-more">
            Còn {OTHER_PLANS_COUNT} gói khác ({OTHER_PLANS_HINT}) —{' '}
            <Link to={PATHS.login}>đăng nhập để xem đầy đủ</Link>.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
