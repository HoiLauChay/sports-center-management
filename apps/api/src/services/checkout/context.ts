import { ERROR_CODE, type CheckoutBuyer } from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Role } from '~/generated/prisma/client';
import accountRepository from '~/repositories/account.repository';
import membershipRepository from '~/repositories/membership.repository';
import settingRepository from '~/repositories/setting.repository';
import { ErrorWithStatus } from '~/rules/error';
import type { ActiveBenefits, BenefitPeriod, CheckoutContext, Db } from '~/services/checkout/types';
import { formatDate, todayInCenter } from '~/utils/time';

const invalidBuyer = (path: string, message: string) =>
  new ErrorWithStatus({
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    code: ERROR_CODE.VALIDATION,
    message: 'Dữ liệu không hợp lệ',
    errors: [{ path, message }],
  });

const loadBenefits = async (db: Db, accountId: string, now: Date): Promise<ActiveBenefits> => {
  const periods: BenefitPeriod[] = (await membershipRepository.findActivePeriods(accountId, db)).map((period) => ({
    ...period,
    periodStart: formatDate(period.periodStart),
    periodEnd: formatDate(period.periodEnd),
  }));
  const periodOn = (date: string) =>
    periods.find(({ periodStart, periodEnd }) => periodStart <= date && date < periodEnd) ?? null;
  return { current: periodOn(todayInCenter(now)), periodOn };
};

const resolveBuyer = async (db: Db, actor: { id: string; role: Role }, buyer: CheckoutBuyer | undefined) => {
  if (actor.role === 'MEMBER') return { kind: 'MEMBER' as const, accountId: actor.id };
  if (!buyer) throw invalidBuyer('body.buyer', 'Vui lòng chọn người mua');
  if ('guest' in buyer) return { kind: 'GUEST' as const, name: buyer.guest.name, phone: buyer.guest.phone! };

  const account = await accountRepository.findById(buyer.accountId, 'MEMBER', db);
  if (account?.status !== 'ACTIVE') throw invalidBuyer('body.buyer.accountId', 'Thành viên không tồn tại');
  return { kind: 'MEMBER' as const, accountId: account.id };
};

export const buildContext = async (
  db: Db,
  actor: { id: string; role: Role },
  buyer: CheckoutBuyer | undefined,
  now = new Date(),
): Promise<CheckoutContext> => {
  const resolved = await resolveBuyer(db, actor, buyer);
  const [settings, benefits] = await Promise.all([
    settingRepository.get(db),
    resolved.kind === 'MEMBER' ? loadBenefits(db, resolved.accountId, now) : null,
  ]);
  return { buyer: resolved, actor, now, settings, benefits, planned: [] };
};
