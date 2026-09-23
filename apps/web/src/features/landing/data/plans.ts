export interface LandingPlan {
  id: string;
  name: string;
  scope: string;
  price: number;
  durationDays: number;
  benefits: string[];
  courtDiscount: number;
  popular?: boolean;
}

// TODO: replace with API data once the backend is ready
export const FEATURED_PLANS: LandingPlan[] = [
  {
    id: 'gym-1m',
    name: 'Gym 1 tháng',
    scope: 'Gym',
    price: 400_000,
    durationDays: 30,
    benefits: ['Phòng gym không giới hạn', '1 buổi PT thử'],
    courtDiscount: 10,
  },
  {
    id: 'all-3m',
    name: 'All-access 3 tháng',
    scope: 'Mọi bộ môn',
    price: 1_650_000,
    durationDays: 90,
    benefits: ['Mọi bộ môn + lớp nhóm', 'Tủ đồ riêng'],
    courtDiscount: 25,
    popular: true,
  },
  {
    id: 'all-1y',
    name: 'All-access 1 năm',
    scope: 'Mọi bộ môn',
    price: 4_900_000,
    durationDays: 365,
    benefits: ['Toàn bộ quyền lợi + xông hơi', 'Đo InBody hàng tháng'],
    courtDiscount: 40,
  },
];

export const OTHER_PLANS_COUNT = 4;
export const OTHER_PLANS_HINT = 'Bơi 1 tháng, Yoga & Zumba 3 tháng, All-access 1 & 6 tháng';

export function formatPlanPeriod(durationDays: number): string {
  if (durationDays >= 365) return 'năm';
  if (durationDays >= 90) return `${durationDays / 30} tháng`;
  return 'tháng';
}
