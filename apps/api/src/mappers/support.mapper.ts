import type { SupportRequest } from '@sports-center/shared';

import type { SupportRow } from '~/repositories/support.repository';

export const toSupportResponse = (row: SupportRow): SupportRequest => ({
  ...row,
  resolvedAt: row.resolvedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});
