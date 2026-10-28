import type { MembershipBenefits } from './types';

export const benefitsText = (pkg: MembershipBenefits) =>
  [
    pkg.gymAccess && 'Gym miễn phí',
    pkg.bookingDiscountPct > 0 && `−${pkg.bookingDiscountPct}% sân`,
    pkg.classDiscountPct > 0 && `−${pkg.classDiscountPct}% lớp`,
    pkg.freeBookingSlotsPerMonth > 0 && `${pkg.freeBookingSlotsPerMonth} slot/tháng`,
    pkg.aiQuestionsPerMonth > 0 && `${pkg.aiQuestionsPerMonth} lượt AI/tháng`,
  ]
    .filter(Boolean)
    .join(' · ') || 'Không có ưu đãi';
