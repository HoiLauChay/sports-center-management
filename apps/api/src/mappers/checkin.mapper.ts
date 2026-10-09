import type { CheckIn } from '@sports-center/shared';

import type { CheckinRow } from '~/repositories/checkin.repository';

export const toCheckInResponse = (row: CheckinRow): CheckIn => ({
  id: row.id,
  account: row.account,
  checkedBy: row.checkedBy,
  checkedInAt: row.checkInTime.toISOString(),
});
