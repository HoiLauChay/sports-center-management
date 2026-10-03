import { mockErrors, mockRequest } from '~/lib/mock/errors';
import { couponsDb } from '../mocks/coupons';
import type { Coupon, CouponInput } from '../types';

/**
 * Coupon CRUD (`/coupons`, manager). Mock until #137 ships: swap each body for
 * `privateApi.get/post/patch/delete<ApiResponse<Coupon…>>('/coupons…')`, the shapes already follow `api.design.md`.
 */
export const couponsService = {
  list: () => mockRequest((): Coupon[] => couponsDb.list()),

  create: (input: CouponInput) => mockRequest(() => couponsDb.create(input)),

  update: (id: string, input: Partial<CouponInput>) =>
    mockRequest(() => {
      if (!id) throw mockErrors.notFound();
      return couponsDb.update(id, input);
    }),

  remove: (id: string) => mockRequest(() => couponsDb.remove(id)),
};
