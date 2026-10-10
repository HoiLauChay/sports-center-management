import type { CreateMaintenanceBody } from '@sports-center/shared';

export type MaintenancePhase = 'PLANNED' | 'ONGOING' | 'DONE';

export type SessionResolution = CreateMaintenanceBody['sessionResolutions'][number];
