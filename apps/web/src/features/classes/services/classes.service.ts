import type { Paginated } from '@sports-center/shared';
import { loadCatalog } from '~/features/checkout/mocks/pricing';
import { mockErrors, mockRequest } from '~/lib/mock/errors';
import { classesDb, ensureClassSeed } from '../mocks/classes';
import type { GymClass } from '../types';

export interface ListClassesQuery {
  page: number;
  limit: number;
  sportId?: string;
  q?: string;
}

async function seeded() {
  const catalog = await loadCatalog();
  ensureClassSeed(catalog.facilities, catalog.settings);
  return catalog;
}

/**
 * Open classes and class detail. Mock until #72, #89 and #108 ship; the shapes follow `api.design.md`
 * (`GET /classes`, `GET /classes/{id}`).
 */
export const classesService = {
  list: (query: ListClassesQuery) =>
    mockRequest(async (): Promise<Paginated<GymClass>> => {
      await seeded();
      const term = query.q?.trim().toLowerCase();
      const rows = classesDb
        .allClasses()
        .filter((item) => classesDb.enrollable(item))
        .filter((item) => !query.sportId || item.course.sport.id === query.sportId)
        .filter((item) => !term || `${item.name} ${item.coach?.fullName ?? ''}`.toLowerCase().includes(term))
        .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
      const start = (query.page - 1) * query.limit;
      return {
        items: rows.slice(start, start + query.limit),
        page: query.page,
        limit: query.limit,
        total: rows.length,
      };
    }, 180),

  get: (id: string) =>
    mockRequest(async () => {
      await seeded();
      const found = classesDb.findDetail(id);
      if (!found) throw mockErrors.notFound('Không tìm thấy lớp học');
      return found;
    }, 150),
};
