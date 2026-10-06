import type { SystemSettings } from '@sports-center/shared';

import type { SettingRow } from '~/repositories/setting.repository';
import { roundMoney } from '~/utils/money';
import { formatTime, fromDbTime } from '~/utils/time';

export const toSettingResponse = (setting: SettingRow): SystemSettings => ({
  openTime: formatTime(fromDbTime(setting.openTime)),
  closeTime: formatTime(fromDbTime(setting.closeTime)),
  slotDurationMinutes: setting.slotDurationMinutes,
  maxAdvanceBookingDays: setting.maxAdvanceBookingDays,
  membershipExpiryWarningDays: setting.membershipExpiryWarningDays,
  topUpMinAmount: roundMoney(setting.topUpMinAmount),
  invoiceExpiryMinutes: setting.invoiceExpiryMinutes,
});
