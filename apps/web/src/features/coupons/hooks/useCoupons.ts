import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { toApiError } from '~/lib/http-errors';
import { nowVN } from '~/lib/time';
import { couponsService } from '../services/coupons.service';
import type { Coupon, CouponInput, CouponState } from '../types';

export const couponsQueryOptions = queryOptions({
  queryKey: ['coupons'],
  queryFn: couponsService.list,
});

export function useCoupons() {
  return useQuery(couponsQueryOptions);
}

export function couponState(coupon: Coupon): CouponState {
  const now = nowVN().toISOString();
  if (!coupon.isActive) return 'OFF';
  if (now < coupon.validFrom) return 'SCHEDULED';
  if (now > coupon.validTo) return 'EXPIRED';
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return 'USED_UP';
  return 'LIVE';
}

export function useCouponMutations() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: couponsQueryOptions.queryKey });

  const save = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CouponInput }) =>
      id ? couponsService.update(id, input) : couponsService.create(input),
    onSuccess: (_, { id }) => {
      void refresh();
      message.success(id ? 'Đã cập nhật mã giảm giá' : 'Đã tạo mã giảm giá');
    },
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => couponsService.update(id, { isActive }),
    onSuccess: (coupon) => {
      void refresh();
      message.success(coupon.isActive ? `Đã bật mã ${coupon.code}` : `Đã tắt mã ${coupon.code}`);
    },
    onError: (error) => message.error(toApiError(error).message),
  });

  const remove = useMutation({
    mutationFn: (coupon: Coupon) => couponsService.remove(coupon.id),
    onSuccess: (_, coupon) => {
      void refresh();
      message.success(`Đã xóa mã ${coupon.code}`);
    },
    onError: (error) => message.error(toApiError(error).message),
  });

  return { save, toggle, remove };
}
