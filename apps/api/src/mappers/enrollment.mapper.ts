import type { Enrollment } from '@sports-center/shared';

import type { EnrollmentRow } from '~/repositories/enrollment.repository';

export const toEnrollmentResponse = (row: EnrollmentRow): Enrollment => ({
  id: row.id,
  class: { id: row.class.id, name: row.class.name },
  account: row.account,
  status: row.status,
  paidAmount: Number(row.orderItem.totalAmount),
  refundedAt: row.orderItem.refundedAt?.toISOString() ?? null,
  orderItemId: row.orderItemId,
  enrolledAt: row.enrolledAt.toISOString(),
});
