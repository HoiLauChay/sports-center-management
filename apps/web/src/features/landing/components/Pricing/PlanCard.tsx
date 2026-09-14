import { Link } from '@tanstack/react-router';
import { Check } from 'lucide-react';
import { PATHS } from '~/constants/paths';
import { formatPlanPeriod, type LandingPlan } from '../../data/plans';

const money = (n: number) => `${n.toLocaleString('vi-VN')}đ`;

export function PlanCard({ plan }: { plan: LandingPlan }) {
  return (
    <div className={`lp-plan ${plan.popular ? 'hot' : ''}`}>
      {plan.popular && <span className="lp-plan-badge">Được chọn nhiều nhất</span>}

      <div className="lp-plan-name">{plan.name}</div>
      <div className="lp-plan-scope">
        {plan.scope} · {plan.durationDays} ngày
      </div>
      <div className="lp-plan-price">
        {money(plan.price)}
        <small>/{formatPlanPeriod(plan.durationDays)}</small>
      </div>

      <ul>
        {plan.benefits.map((benefit) => (
          <li key={benefit}>
            <Check size={15} /> {benefit}
          </li>
        ))}
        {plan.courtDiscount > 0 && (
          <li className="hl">
            <Check size={15} /> Giảm {plan.courtDiscount}% giá thuê sân
          </li>
        )}
      </ul>

      <Link
        to={PATHS.register}
        className={`lp-btn ${plan.popular ? 'lp-btn-primary' : 'lp-btn-ghost'}`}
        style={{ width: '100%' }}
      >
        Đăng ký gói này
      </Link>
    </div>
  );
}
