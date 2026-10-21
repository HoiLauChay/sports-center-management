import type { FacilityPackagePreview } from '@sports-center/shared';

export type {
  FacilityPackagePreview as PackagePreview,
  FacilityPackagePreviewBody as PackagePreviewRequest,
} from '@sports-center/shared';

export type PackagePreviewBooking = FacilityPackagePreview['bookings'][number];
export type PackageConflict = NonNullable<PackagePreviewBooking['conflict']>;

/** A range of consecutive slots picked on the grid. */
export interface SlotSelection {
  facilityId: string;
  startIndex: number;
  count: number;
}
