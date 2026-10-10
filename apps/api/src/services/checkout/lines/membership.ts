import {
  ERROR_CODE,
  type CheckoutItemInput,
  type MembershipBenefits,
  type MembershipSnapshot,
} from '@sports-center/shared';

import memberMembershipRepository from '~/repositories/memberMembership.repository';
import membershipRepository, { type MembershipRow } from '~/repositories/membership.repository';
import { lineError } from '~/services/checkout/lines/shared';
import type { CheckoutContext, Db, LineHandler, LineResult, PreparedOrder } from '~/services/checkout/types';
import { addDays, formatDate, todayInCenter } from '~/utils/time';

type MembershipInput = Extract<CheckoutItemInput, { type: 'MEMBERSHIP' }>;

interface MembershipData {
  packageId: string;
  durationDays: number;
  benefits: MembershipBenefits;
  renewFrom?: { membershipId: string; start: string };
}

const planPeriod = async (db: Db, ctx: CheckoutContext, accountId: string, packageId: string, days: number) => {
  const today = todayInCenter(ctx.now);
  const active = await memberMembershipRepository.findActive(accountId, db);
  if (active && formatDate(active.endDate) > today) {
    if (active.packageId !== packageId) return null;
    const start = formatDate(active.endDate);
    return { renewId: active.id, expireId: null, start, end: addDays(start, days) };
  }
  return { renewId: null, expireId: active?.id ?? null, start: today, end: addDays(today, days) };
};

const onSale = (row: { isActive: boolean } | null) => !!row?.isActive;

const priceLine = (
  membership: MembershipRow,
  period: { start: string; end: string },
  renewal: boolean,
  renewFrom?: MembershipData['renewFrom'],
): LineResult<MembershipData, MembershipSnapshot> => {
  const benefits: MembershipBenefits = {
    gymAccess: membership.gymAccess,
    bookingDiscountPct: membership.bookingDiscountPct,
    classDiscountPct: membership.classDiscountPct,
    freeBookingSlotsPerMonth: membership.freeBookingSlotsPerMonth,
  };
  const price = Number(membership.price);
  return {
    ok: true,
    subtotal: price,
    membershipDiscount: 0,
    snapshot: {
      title: `Gói ${membership.name} · ${membership.durationDays} ngày`,
      startAt: period.start,
      endAt: period.end,
      discountPct: 0,
      packageName: membership.name,
      price,
      durationDays: membership.durationDays,
      renewal,
      benefits,
    },
    data: { packageId: membership.id, durationDays: membership.durationDays, benefits, renewFrom },
  };
};

export const renewalOrder = (membership: MembershipRow, membershipId: string, start: string): PreparedOrder => {
  const price = Number(membership.price);
  return {
    lines: [
      {
        lineNumber: 1,
        input: { type: 'MEMBERSHIP', packageId: membership.id },
        result: priceLine(membership, { start, end: addDays(start, membership.durationDays) }, true, {
          membershipId,
          start,
        }),
        couponDiscount: 0,
        couponId: null,
      },
    ],
    coupon: null,
    subtotal: price,
    membershipDiscount: 0,
    couponDiscount: 0,
    total: price,
    valid: true,
    membershipName: null,
  };
};

export const membershipHandler: LineHandler<MembershipInput, MembershipData, MembershipSnapshot> = {
  type: 'MEMBERSHIP',
  guestAllowed: false,
  needsScheduleLock: false,

  lockTargets: () => ({}),

  prepare: async (db, ctx, input) => {
    if (ctx.buyer.kind === 'GUEST') return lineError(ERROR_CODE.GUEST_NOT_ALLOWED, 'Khách vãng lai không mua gói');
    const membership = await membershipRepository.findById(input.packageId, db);
    if (!membership || !onSale(membership)) return lineError(ERROR_CODE.INVALID_STATE, 'Gói đã ngừng bán');

    const period = await planPeriod(db, ctx, ctx.buyer.accountId, membership.id, membership.durationDays);
    if (!period) return lineError(ERROR_CODE.INVALID_STATE, 'Người mua đang có gói khác còn hiệu lực');

    return priceLine(membership, period, !!period.renewId);
  },

  verify: async (tx, _ctx, { data }) =>
    onSale(await membershipRepository.findById(data.packageId, tx))
      ? null
      : { code: ERROR_CODE.INVALID_STATE, message: 'Gói đã ngừng bán' },

  fulfill: async (tx, ctx, { data }, orderItemId) => {
    if (ctx.buyer.kind !== 'MEMBER') throw new Error('Membership requires a member buyer');
    const accountId = ctx.buyer.accountId;
    const period = data.renewFrom
      ? {
          renewId: data.renewFrom.membershipId,
          expireId: null,
          start: data.renewFrom.start,
          end: addDays(data.renewFrom.start, data.durationDays),
        }
      : await planPeriod(tx, ctx, accountId, data.packageId, data.durationDays);
    if (!period) throw new Error('Membership period changed after pricing');

    if (period.expireId) await memberMembershipRepository.update(period.expireId, { status: 'EXPIRED' }, tx);
    const membershipId = period.renewId
      ? (
          await memberMembershipRepository.update(
            period.renewId,
            { endDate: new Date(period.end), autoRenew: true, cancelledAt: null },
            tx,
          )
        ).id
      : (
          await memberMembershipRepository.create(
            {
              accountId,
              packageId: data.packageId,
              startDate: new Date(period.start),
              endDate: new Date(period.end),
              autoRenew: true,
            },
            tx,
          )
        ).id;

    await memberMembershipRepository.addPeriod(
      {
        membershipId,
        orderItemId,
        periodStart: new Date(period.start),
        periodEnd: new Date(period.end),
        ...data.benefits,
      },
      tx,
    );
    return { refId: membershipId };
  },
};
