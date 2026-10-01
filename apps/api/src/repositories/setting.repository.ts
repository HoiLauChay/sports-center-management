import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

const SETTINGS_ID = 1;

const settingSelect = {
  openTime: true,
  closeTime: true,
  slotDurationMinutes: true,
  maxAdvanceBookingDays: true,
  bookingCancelDeadlineHours: true,
  courseCancelDeadlineDays: true,
  membershipExpiryWarningDays: true,
  topUpMinAmount: true,
  invoiceExpiryMinutes: true,
} satisfies Prisma.SystemSettingSelect;

export type SettingRow = Prisma.SystemSettingGetPayload<{ select: typeof settingSelect }>;

class SettingRepository {
  get = (tx: Prisma.TransactionClient = prisma) =>
    tx.systemSetting.findUniqueOrThrow({ where: { id: SETTINGS_ID }, select: settingSelect });

  update = (data: Prisma.SystemSettingUpdateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.systemSetting.update({ where: { id: SETTINGS_ID }, data, select: settingSelect });
}

export default new SettingRepository();
