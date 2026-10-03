import { commerceStore } from '~/lib/mock/commerce';
import { mockErrors } from '~/lib/mock/errors';
import { createMockStore, newId } from '~/lib/mock/store';
import { nowVN } from '~/lib/time';
import type { Coupon, CouponInput } from '../types';

type StoredCoupon = Omit<Coupon, 'usedCount'>;

interface CouponsState {
  coupons: StoredCoupon[];
}

const iso = (offsetDays: number) => nowVN().add(offsetDays, 'day').startOf('day').toISOString();

const store = createMockStore<CouponsState>('sc_mock_coupons_v1', () => ({
  coupons: [
    {
      id: newId(),
      code: 'WELCOME20',
      name: 'Chào thành viên mới giảm 20%',
      discountType: 'PERCENT',
      discountValue: 20,
      maxDiscount: 200_000,
      validFrom: iso(-30),
      validTo: iso(60),
      maxUses: 100,
      maxUsesPerUser: 1,
      minOrderAmount: 200_000,
      applicableTypes: null,
      isActive: true,
    },
    {
      id: newId(),
      code: 'SAN50K',
      name: 'Giảm 50.000₫ khi đặt sân',
      discountType: 'FIXED',
      discountValue: 50_000,
      maxDiscount: null,
      validFrom: iso(-7),
      validTo: iso(30),
      maxUses: null,
      maxUsesPerUser: 3,
      minOrderAmount: 100_000,
      applicableTypes: ['FACILITY_BOOKING', 'FACILITY_PACKAGE'],
      isActive: true,
    },
    {
      id: newId(),
      code: 'LOP10',
      name: 'Giảm 10% học phí',
      discountType: 'PERCENT',
      discountValue: 10,
      maxDiscount: 300_000,
      validFrom: iso(-3),
      validTo: iso(45),
      maxUses: 50,
      maxUsesPerUser: 1,
      minOrderAmount: null,
      applicableTypes: ['COURSE_ENROLLMENT'],
      isActive: true,
    },
    {
      id: newId(),
      code: 'TET2025',
      name: 'Ưu đãi dịp Tết (đã hết hạn)',
      discountType: 'PERCENT',
      discountValue: 15,
      maxDiscount: 150_000,
      validFrom: iso(-400),
      validTo: iso(-300),
      maxUses: 200,
      maxUsesPerUser: 1,
      minOrderAmount: null,
      applicableTypes: null,
      isActive: true,
    },
    {
      id: newId(),
      code: 'NOIBO',
      name: 'Mã nội bộ (đang tắt)',
      discountType: 'FIXED',
      discountValue: 100_000,
      maxDiscount: null,
      validFrom: iso(-10),
      validTo: iso(90),
      maxUses: 10,
      maxUsesPerUser: 1,
      minOrderAmount: null,
      applicableTypes: null,
      isActive: false,
    },
  ],
}));

const normalize = (code: string) => code.trim().toUpperCase();

function withUsage(coupon: StoredCoupon): Coupon {
  const usedCount = commerceStore.get().orders.filter((order) => order.coupon?.code === coupon.code).length;
  return { ...coupon, usedCount };
}

function assertUnique(state: CouponsState, code: string, exceptId?: string) {
  if (state.coupons.some((coupon) => coupon.code === code && coupon.id !== exceptId)) {
    throw mockErrors.invalid('body.code', 'Mã giảm giá đã tồn tại (không phân biệt hoa thường)');
  }
}

export const couponsDb = {
  list: (): Coupon[] => store.get().coupons.map(withUsage),

  findByCode(code: string): Coupon | undefined {
    const stored = store.get().coupons.find((coupon) => coupon.code === normalize(code));
    return stored && withUsage(stored);
  },

  create(input: CouponInput): Coupon {
    return store.update((state) => {
      const code = normalize(input.code);
      assertUnique(state, code);
      const coupon: StoredCoupon = { ...input, code, id: newId() };
      state.coupons.unshift(coupon);
      return withUsage(coupon);
    });
  },

  update(id: string, input: Partial<CouponInput>): Coupon {
    return store.update((state) => {
      const coupon = state.coupons.find((entry) => entry.id === id);
      if (!coupon) throw mockErrors.notFound('Không tìm thấy mã giảm giá');
      if (input.code !== undefined) {
        input.code = normalize(input.code);
        assertUnique(state, input.code, id);
      }
      Object.assign(coupon, input);
      return withUsage(coupon);
    });
  },

  remove(id: string) {
    store.update((state) => {
      const index = state.coupons.findIndex((entry) => entry.id === id);
      if (index < 0) throw mockErrors.notFound('Không tìm thấy mã giảm giá');
      state.coupons.splice(index, 1);
    });
  },

  /** How many orders `accountId` already placed with this code (quota counts orders, refunded ones included). */
  usedBy(code: string, accountId: string): number {
    return commerceStore.get().orders.filter((order) => order.coupon?.code === code && order.account?.id === accountId)
      .length;
  },
};
