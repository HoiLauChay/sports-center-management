import type { ApiResponse } from '@sports-center/shared';
import { privateApi } from '~/lib/http';
import type { Coupon, CouponInput } from '../types';

/**
 * Coupon CRUD (`/coupons`, manager).
 */
export const couponsService = {
  list: async (): Promise<Coupon[]> => {
    const { data } = await privateApi.get<ApiResponse<Coupon[]>>('/coupons');
    return data.result;
  },

  create: async (input: CouponInput): Promise<Coupon> => {
    const { data } = await privateApi.post<ApiResponse<Coupon>>('/coupons', input);
    return data.result;
  },

  update: async (id: string, input: Partial<CouponInput>): Promise<Coupon> => {
    const { data } = await privateApi.patch<ApiResponse<Coupon>>(`/coupons/${encodeURIComponent(id)}`, input);
    return data.result;
  },

  remove: async (id: string): Promise<void> => {
    await privateApi.delete(`/coupons/${encodeURIComponent(id)}`);
  },
};
