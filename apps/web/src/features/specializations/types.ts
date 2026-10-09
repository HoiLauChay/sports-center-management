import type { SpecializationStatus } from '@sports-center/shared';
import type { TagMap } from '~/components/ui/MappedTag';

export { SPECIALIZATION_STATUSES } from '@sports-center/shared';
export type { ListSpecializationsQuery, Specialization, SpecializationStatus } from '@sports-center/shared';

export const SPECIALIZATION_STATUS_TAG: TagMap<SpecializationStatus> = {
  PENDING: { label: 'Chờ duyệt', color: 'warning' },
  APPROVED: { label: 'Đã duyệt', color: 'success' },
  REJECTED: { label: 'Từ chối', color: 'error' },
};
