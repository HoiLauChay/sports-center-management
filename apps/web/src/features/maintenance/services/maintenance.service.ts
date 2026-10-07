import type { Account } from '@sports-center/shared';
import { loadCatalog } from '~/features/checkout/mocks/pricing';
import { actorOf } from '~/features/checkout/services/checkout.service';
import { ensureClassSeed } from '~/features/classes/mocks/classes';
import { mockRequest } from '~/lib/mock/errors';
import { createMaintenance, deleteMaintenance, listMaintenances, previewMaintenance } from '../mocks/maintenance';
import type { CreateMaintenanceBody, ListMaintenancesQuery, MaintenanceRequest } from '../types';

async function seeded() {
  const catalog = await loadCatalog();
  ensureClassSeed(catalog.facilities, catalog.settings);
  return catalog;
}

/**
 * Facility maintenance (`GET /maintenances`, `POST /maintenances/preview`, `POST /maintenances`,
 * `DELETE /maintenances/{id}`). Mock until #180 ships; the shapes follow `api.design.md`, so each body becomes a
 * `privateApi` call. A 409 `MAINTENANCE_BLOCKED` lists what cannot be handled in `bookings` and `sessions`.
 */
export const maintenanceService = {
  list: (query: ListMaintenancesQuery) =>
    mockRequest(async () => {
      await seeded();
      return listMaintenances(query);
    }, 150),

  preview: (request: MaintenanceRequest) =>
    mockRequest(async () => {
      const { facilities } = await seeded();
      return previewMaintenance(request, facilities);
    }, 300),

  create: (user: Account, body: CreateMaintenanceBody) =>
    mockRequest(async () => {
      const { facilities } = await seeded();
      return createMaintenance(actorOf(user), body, facilities);
    }, 500),

  remove: (id: string) =>
    mockRequest(async () => {
      await seeded();
      return deleteMaintenance(id);
    }, 250),
};
