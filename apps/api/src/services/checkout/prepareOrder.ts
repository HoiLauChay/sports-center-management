import { ERROR_CODE, type CheckoutItemInput } from '@sports-center/shared';

import { lineHandlers } from '~/services/checkout/lines';
import type { CheckoutContext, Db, LineError, PreparedLine, PreparedOrder } from '~/services/checkout/types';

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

export const prepareOrder = async (
  db: Db,
  ctx: CheckoutContext,
  inputs: CheckoutItemInput[],
  couponCode?: string,
): Promise<PreparedOrder> => {
  const lines: PreparedLine[] = [];

  for (const [index, input] of inputs.entries()) {
    const lineNumber = index + 1;
    const error = precheck(ctx, input, inputs.slice(0, index));
    const result = error ? { ok: false as const, error } : await lineHandlers[input.type]!.prepare(db, ctx, input);
    if (result.ok) ctx.planned.push({ lineNumber, type: input.type, data: result.data });
    lines.push({ lineNumber, input, result });
  }

  const coupon = couponCode
    ? { code: couponCode, valid: false, discount: 0, error: 'Mã giảm giá chưa được hỗ trợ' }
    : null;
  const priced = lines.map(({ result }) => result).filter((result) => result.ok);
  const subtotal = priced.reduce((sum, result) => sum + result.subtotal, 0);
  const membershipDiscount = priced.reduce((sum, result) => sum + result.membershipDiscount, 0);

  return {
    lines,
    coupon,
    subtotal,
    membershipDiscount,
    couponDiscount: 0,
    total: subtotal - membershipDiscount,
    valid: priced.length === lines.length && coupon === null,
  };
};
