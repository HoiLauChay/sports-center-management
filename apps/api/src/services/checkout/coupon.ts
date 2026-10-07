import couponRepository from '~/repositories/coupon.repository';
import invoiceRepository from '~/repositories/invoice.repository';
import type { AppliedCoupon, CheckoutContext, Db, PreparedLine } from '~/services/checkout/types';
import { allocate, percentOf } from '~/utils/money';

interface CouponResult {
  coupon: AppliedCoupon;
  discounts: Map<number, number>;
}

const lineTotal = ({ result }: PreparedLine) => (result.ok ? result.subtotal - result.membershipDiscount : 0);

export const applyCoupon = async (
  db: Db,
  ctx: CheckoutContext,
  lines: PreparedLine[],
  code: string,
): Promise<CouponResult> => {
  const rejected = (error: string, row?: { id: string; name: string }): CouponResult => ({
    coupon: { id: row?.id ?? null, code, name: row?.name ?? null, valid: false, discount: 0, error },
    discounts: new Map(),
  });

  if (ctx.buyer.kind === 'GUEST') return rejected('Khách vãng lai không dùng được mã giảm giá');
  const coupon = await couponRepository.findByCode(code, db);
  if (!coupon) return rejected('Mã giảm giá không tồn tại');
  if (!coupon.isActive) return rejected('Mã giảm giá đang tạm ngưng', coupon);
  if (ctx.now < coupon.validFrom) return rejected('Mã giảm giá chưa đến thời gian áp dụng', coupon);
  if (ctx.now >= coupon.validTo) return rejected('Mã giảm giá đã hết hạn', coupon);

  const eligible = lines.filter(
    ({ input, result }) =>
      result.ok && (coupon.applicableTypes.length === 0 || coupon.applicableTypes.includes(input.type)),
  );
  if (eligible.length === 0) return rejected('Mã giảm giá không áp dụng cho dịch vụ trong đơn', coupon);

  const original = eligible.reduce((sum, { result }) => sum + (result.ok ? result.subtotal : 0), 0);
  const minimum = Number(coupon.minOrderAmount ?? 0);
  if (original < minimum) {
    return rejected(`Đơn chưa đạt giá trị tối thiểu ${minimum.toLocaleString('vi-VN')}đ`, coupon);
  }

  const [ordered, orderedByBuyer] = await couponRepository.countUses(coupon.id, ctx.buyer.accountId, db);
  const [held, heldByBuyer] = await invoiceRepository.countHeldCoupon(coupon.id, ctx.buyer.accountId, ctx.now, db);
  const [used, usedByBuyer] = [ordered + held, orderedByBuyer + heldByBuyer];
  if (coupon.maxUses !== null && used >= coupon.maxUses) return rejected('Mã giảm giá đã hết lượt', coupon);
  if (usedByBuyer >= coupon.maxUsesPerUser) return rejected('Người mua đã dùng hết lượt của mã này', coupon);

  const totals = eligible.map(lineTotal);
  const base = totals.reduce((sum, total) => sum + total, 0);
  const value = Number(coupon.discountValue);
  const raw =
    coupon.discountType === 'FIXED'
      ? value
      : Math.min(percentOf(base, value), Number(coupon.maxDiscount ?? Number.MAX_SAFE_INTEGER));
  const discount = Math.min(raw, base);
  const shares = allocate(discount, totals);

  return {
    coupon: { id: coupon.id, code, name: coupon.name, valid: true, discount },
    discounts: new Map(eligible.map(({ lineNumber }, index) => [lineNumber, shares[index]!])),
  };
};
