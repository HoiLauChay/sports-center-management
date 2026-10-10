import couponRepository, { type CouponRow } from '~/repositories/coupon.repository';
import invoiceRepository from '~/repositories/invoice.repository';
import type { AppliedCoupon, CheckoutContext, Db, PreparedLine } from '~/services/checkout/types';
import { allocate, percentOf } from '~/utils/money';

interface Candidate {
  coupon: AppliedCoupon;
  lines: PreparedLine[];
  shares: number[];
}

export interface CouponResult {
  coupons: AppliedCoupon[];
  discounts: Map<number, { couponId: string; amount: number }>;
}

const baseOf = ({ result }: PreparedLine) => (result.ok ? result.subtotal - result.membershipDiscount : 0);
const originalOf = ({ result }: PreparedLine) => (result.ok ? result.subtotal : 0);

const rejected = (code: string, error: string, row?: CouponRow | null): AppliedCoupon => ({
  id: row?.id ?? null,
  code,
  name: row?.name ?? null,
  valid: false,
  applied: false,
  discount: 0,
  lineNumbers: [],
  error,
});

const evaluate = async (
  db: Db,
  ctx: CheckoutContext,
  lines: PreparedLine[],
  code: string,
): Promise<Candidate | AppliedCoupon> => {
  if (ctx.buyer.kind === 'GUEST') return rejected(code, 'Khách vãng lai không dùng được mã giảm giá');
  const coupon = await couponRepository.findByCode(code, db);
  if (!coupon) return rejected(code, 'Mã giảm giá không tồn tại');
  if (!coupon.isActive) return rejected(code, 'Mã giảm giá đang tạm ngưng', coupon);
  if (ctx.now < coupon.validFrom) return rejected(code, 'Mã giảm giá chưa đến thời gian áp dụng', coupon);
  if (ctx.now >= coupon.validTo) return rejected(code, 'Mã giảm giá đã hết hạn', coupon);

  const covered = lines.filter(
    ({ input, result }) =>
      result.ok && (coupon.applicableTypes.length === 0 || coupon.applicableTypes.includes(input.type)),
  );
  if (covered.length === 0) return rejected(code, 'Mã giảm giá không áp dụng cho dịch vụ trong đơn', coupon);

  const minimum = Number(coupon.minOrderAmount ?? 0);
  if (covered.reduce((sum, line) => sum + originalOf(line), 0) < minimum) {
    return rejected(code, `Dịch vụ áp mã chưa đạt giá trị tối thiểu ${minimum.toLocaleString('vi-VN')}đ`, coupon);
  }

  const [ordered, orderedByBuyer] = await couponRepository.countUses(coupon.id, ctx.buyer.accountId, db);
  const [held, heldByBuyer] = await invoiceRepository.countHeldCoupon(coupon.id, ctx.buyer.accountId, ctx.now, db);
  if (coupon.maxUses !== null && ordered + held >= coupon.maxUses) {
    return rejected(code, 'Mã giảm giá đã hết lượt', coupon);
  }
  if (orderedByBuyer + heldByBuyer >= coupon.maxUsesPerUser) {
    return rejected(code, 'Người mua đã dùng hết lượt của mã này', coupon);
  }

  const totals = covered.map(baseOf);
  const base = totals.reduce((sum, total) => sum + total, 0);
  const value = Number(coupon.discountValue);
  const raw =
    coupon.discountType === 'FIXED'
      ? value
      : Math.min(percentOf(base, value), Number(coupon.maxDiscount ?? Number.MAX_SAFE_INTEGER));
  const discount = Math.min(raw, base);
  return {
    coupon: {
      id: coupon.id,
      code,
      name: coupon.name,
      valid: true,
      applied: true,
      discount,
      lineNumbers: covered.map(({ lineNumber }) => lineNumber),
    },
    lines: covered,
    shares: allocate(discount, totals),
  };
};

const overlaps = (a: Candidate, b: Candidate) =>
  a.coupon.lineNumbers.some((lineNumber) => b.coupon.lineNumbers.includes(lineNumber));

/**
 * The combination of valid coupons with the largest total discount whose lines do not overlap: a coupon covers every
 * line of the types it applies to or none, so two coupons never share a line. Ties keep the codes entered first.
 */
const bestCombination = (candidates: Candidate[]) => {
  let best: Candidate[] = [];
  let bestDiscount = 0;
  for (let mask = 1; mask < 1 << candidates.length; mask++) {
    const picked = candidates.filter((_, index) => mask & (1 << index));
    if (picked.some((a, index) => picked.slice(index + 1).some((b) => overlaps(a, b)))) continue;
    const discount = picked.reduce((sum, { coupon }) => sum + coupon.discount, 0);
    if (discount > bestDiscount) [best, bestDiscount] = [picked, discount];
  }
  return best;
};

export const applyCoupons = async (
  db: Db,
  ctx: CheckoutContext,
  lines: PreparedLine[],
  codes: string[],
): Promise<CouponResult> => {
  const evaluated: (Candidate | AppliedCoupon)[] = [];
  for (const code of codes) evaluated.push(await evaluate(db, ctx, lines, code));
  const candidates = evaluated.filter((entry): entry is Candidate => 'lines' in entry);
  const chosen = new Set(bestCombination(candidates));

  const discounts: CouponResult['discounts'] = new Map();
  for (const candidate of chosen) {
    candidate.lines.forEach(({ lineNumber }, index) =>
      discounts.set(lineNumber, { couponId: candidate.coupon.id!, amount: candidate.shares[index]! }),
    );
  }

  const coupons = evaluated.map((entry): AppliedCoupon => {
    if (!('lines' in entry)) return entry;
    if (chosen.has(entry)) return entry.coupon;
    const winner = [...chosen].find((other) => overlaps(entry, other));
    return {
      ...entry.coupon,
      applied: false,
      discount: 0,
      lineNumbers: [],
      error: winner
        ? `Trùng dịch vụ với mã ${winner.coupon.code} đang giảm nhiều hơn, mỗi dịch vụ chỉ áp một mã`
        : 'Mã không giảm thêm cho đơn này',
    };
  });
  return { coupons, discounts };
};
