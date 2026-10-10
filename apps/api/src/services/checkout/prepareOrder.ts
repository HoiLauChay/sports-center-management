import { ERROR_CODE, type CheckoutItemInput } from '@sports-center/shared';

import invoiceRepository from '~/repositories/invoice.repository';
import { applyCoupons } from '~/services/checkout/coupon';
import { lineHandlers } from '~/services/checkout/lines';
import type {
  CheckoutContext,
  CounterOrderPayload,
  Db,
  LineError,
  PreparedLine,
  PreparedOrder,
} from '~/services/checkout/types';

const precheck = (ctx: CheckoutContext, input: CheckoutItemInput, earlier: CheckoutItemInput[]): LineError | null => {
  const handler = lineHandlers[input.type];
  if (!handler) return { code: ERROR_CODE.LINE_TYPE_UNSUPPORTED, message: 'Loại dịch vụ này chưa được hỗ trợ' };
  if (ctx.buyer.kind === 'GUEST' && !handler.guestAllowed) {
    return { code: ERROR_CODE.GUEST_NOT_ALLOWED, message: 'Khách vãng lai chỉ được đặt sân lẻ' };
  }
  if (input.type === 'MEMBERSHIP' && earlier.some(({ type }) => type === 'MEMBERSHIP')) {
    return { code: ERROR_CODE.MEMBERSHIP_LINE_LIMIT, message: 'Mỗi đơn chỉ được mua một gói thành viên' };
  }
  return null;
};

export const loadHeldLines = async (db: Db, ctx: CheckoutContext) => {
  for (const invoice of await invoiceRepository.findHeldOrders(ctx.now, db)) {
    const { prepared } = invoice.requestPayload as unknown as CounterOrderPayload;
    for (const { lineNumber, input, result } of prepared.lines) {
      if (!result.ok) continue;
      ctx.planned.push({
        lineNumber,
        accountId: invoice.accountId,
        type: input.type,
        data: result.data,
        uses: result.uses ?? [],
      });
    }
  }
};

export const prepareOrder = async (
  db: Db,
  ctx: CheckoutContext,
  inputs: CheckoutItemInput[],
  couponCodes: string[] = [],
): Promise<PreparedOrder> => {
  const lines: PreparedLine[] = [];
  const buyerId = ctx.buyer.kind === 'MEMBER' ? ctx.buyer.accountId : null;
  await loadHeldLines(db, ctx);

  for (const [index, input] of inputs.entries()) {
    const lineNumber = index + 1;
    const error = precheck(ctx, input, inputs.slice(0, index));
    const result = error ? { ok: false as const, error } : await lineHandlers[input.type]!.prepare(db, ctx, input);
    if (result.ok)
      ctx.planned.push({
        lineNumber,
        accountId: buyerId,
        type: input.type,
        data: result.data,
        uses: result.uses ?? [],
      });
    lines.push({ lineNumber, input, result, couponDiscount: 0, couponId: null });
  }

  const { coupons, discounts } = await applyCoupons(db, ctx, lines, couponCodes);
  for (const line of lines) {
    const share = discounts.get(line.lineNumber);
    line.couponDiscount = share?.amount ?? 0;
    line.couponId = share?.couponId ?? null;
  }

  const priced = lines.map(({ result }) => result).filter((result) => result.ok);
  const subtotal = priced.reduce((sum, result) => sum + result.subtotal, 0);
  const membershipDiscount = priced.reduce((sum, result) => sum + result.membershipDiscount, 0);
  const couponDiscount = lines.reduce((sum, line) => sum + line.couponDiscount, 0);

  return {
    lines,
    coupons,
    subtotal,
    membershipDiscount,
    couponDiscount,
    total: subtotal - membershipDiscount - couponDiscount,
    valid: priced.length === lines.length && coupons.every(({ valid }) => valid),
    membershipName: membershipDiscount > 0 ? (ctx.benefits?.current?.packageName ?? null) : null,
  };
};
