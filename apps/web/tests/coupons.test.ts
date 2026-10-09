import { describe, expect, it, spyOn } from 'bun:test';
import { couponState } from '../src/features/coupons/hooks/useCoupons';
import { couponSchema } from '../src/features/coupons/schemas/coupon.schema';
import { couponsService } from '../src/features/coupons/services/coupons.service';
import type { Coupon, CouponInput } from '../src/features/coupons/types';
import { privateApi } from '../src/lib/http';

describe('couponSchema', () => {
  const baseInput = {
    code: 'SALE50',
    name: 'Giảm giá mùa hè',
    discountType: 'PERCENT' as const,
    discountValue: 50,
    maxDiscount: 100_000,
    validFrom: '2026-10-01T00:00:00.000Z',
    validTo: '2026-10-31T23:59:59.000Z',
    maxUses: 100,
    maxUsesPerUser: 1,
    minOrderAmount: 200_000,
    applicableTypes: ['MEMBERSHIP' as const],
    isActive: true,
  };

  it('accepts valid percent coupon <= 100', () => {
    const result = couponSchema.safeParse(baseInput);
    expect(result.success).toBe(true);
  });

  it('rejects percent coupon > 100 (Acceptance Criteria #141)', () => {
    const result = couponSchema.safeParse({ ...baseInput, discountValue: 101 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('discountValue'));
      expect(issue).toBeDefined();
      expect(issue?.message).toContain('không được vượt quá 100');
    }
  });

  it('accepts fixed discount coupon above 100', () => {
    const result = couponSchema.safeParse({
      ...baseInput,
      discountType: 'FIXED',
      discountValue: 50_000,
      maxDiscount: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects if validTo is before or equal to validFrom', () => {
    const result = couponSchema.safeParse({
      ...baseInput,
      validFrom: '2026-10-31T00:00:00.000Z',
      validTo: '2026-10-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes('validTo'));
      expect(issue).toBeDefined();
      expect(issue?.message).toContain('sau ngày bắt đầu');
    }
  });
});

describe('couponState', () => {
  const baseCoupon: Coupon = {
    id: '00000000-0000-0000-0000-000000000001',
    code: 'TEST',
    name: 'Test Coupon',
    discountType: 'PERCENT',
    discountValue: 20,
    maxDiscount: null,
    validFrom: '2026-01-01T00:00:00.000Z',
    validTo: '2026-12-31T23:59:59.000Z',
    maxUses: 50,
    maxUsesPerUser: 1,
    minOrderAmount: null,
    applicableTypes: null,
    isActive: true,
    usedCount: 5,
  };

  it('returns OFF when coupon is inactive', () => {
    expect(couponState({ ...baseCoupon, isActive: false })).toBe('OFF');
  });

  it('returns SCHEDULED when coupon is in the future', () => {
    expect(couponState({ ...baseCoupon, validFrom: '2099-01-01T00:00:00.000Z' })).toBe('SCHEDULED');
  });

  it('returns EXPIRED when coupon validTo has passed', () => {
    expect(couponState({ ...baseCoupon, validTo: '2020-01-01T00:00:00.000Z' })).toBe('EXPIRED');
  });

  it('returns USED_UP when usedCount reaches maxUses', () => {
    expect(couponState({ ...baseCoupon, maxUses: 10, usedCount: 10 })).toBe('USED_UP');
  });

  it('returns LIVE when coupon is active and within validity and use limits', () => {
    expect(couponState(baseCoupon)).toBe('LIVE');
  });
});

describe('couponsService', () => {
  it('calls GET /coupons on list', async () => {
    const mockCoupons: Coupon[] = [];
    const getSpy = spyOn(privateApi, 'get').mockResolvedValue({ data: { status: true, result: mockCoupons } } as never);

    const result = await couponsService.list();
    expect(getSpy).toHaveBeenCalledWith('/coupons');
    expect(result).toBe(mockCoupons);
    getSpy.mockRestore();
  });

  it('calls POST /coupons on create', async () => {
    const input: CouponInput = {
      code: 'NEW',
      name: 'New Coupon',
      discountType: 'PERCENT',
      discountValue: 15,
      maxDiscount: null,
      validFrom: '2026-10-01T00:00:00.000Z',
      validTo: '2026-10-31T23:59:59.000Z',
      maxUses: null,
      maxUsesPerUser: 1,
      minOrderAmount: null,
      applicableTypes: null,
      isActive: true,
    };
    const created = { id: 'uuid-1', usedCount: 0, ...input };
    const postSpy = spyOn(privateApi, 'post').mockResolvedValue({ data: { status: true, result: created } } as never);

    const result = await couponsService.create(input);
    expect(postSpy).toHaveBeenCalledWith('/coupons', input);
    expect(result).toBe(created);
    postSpy.mockRestore();
  });

  it('calls PATCH /coupons/:id on update', async () => {
    const id = '00000000-0000-0000-0000-000000000001';
    const updateInput = { isActive: false };
    const updated = { id, ...updateInput };
    const patchSpy = spyOn(privateApi, 'patch').mockResolvedValue({ data: { status: true, result: updated } } as never);

    const result = await couponsService.update(id, updateInput);
    expect(patchSpy).toHaveBeenCalledWith(`/coupons/${id}`, updateInput);
    expect(result).toBe(updated as never);
    patchSpy.mockRestore();
  });

  it('calls DELETE /coupons/:id on remove', async () => {
    const id = '00000000-0000-0000-0000-000000000001';
    const deleteSpy = spyOn(privateApi, 'delete').mockResolvedValue({ data: { status: true } } as never);

    await couponsService.remove(id);
    expect(deleteSpy).toHaveBeenCalledWith(`/coupons/${id}`);
    deleteSpy.mockRestore();
  });
});
