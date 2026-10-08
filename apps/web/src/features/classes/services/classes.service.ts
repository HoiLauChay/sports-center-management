import type {
  Account,
  ApiResponse,
  ClassDetail,
  ClassSummary,
  ListClassesQuery as ClassesQuery,
  Paginated,
} from '@sports-center/shared';
import { cancelEnrollment, listMyEnrollments } from '~/features/bookings/mocks/bookings';
import { loadCatalog } from '~/features/checkout/mocks/pricing';
import { actorOf } from '~/features/checkout/services/checkout.service';
import { walletService } from '~/features/wallet/services/wallet.service';
import { privateApi } from '~/lib/http';
import { mockRequest } from '~/lib/mock/errors';
import { ensureClassSeed } from '../mocks/classes';

export type ListClassesQuery = Pick<ClassesQuery, 'page' | 'limit' | 'sportId' | 'coachId' | 'q'>;

async function seeded() {
  const catalog = await loadCatalog();
  ensureClassSeed(catalog.facilities, catalog.settings);
  return catalog;
}

/**
 * Classes open for enrollment and class detail come from the API. My enrollments and their cancellation stay mock
 * until `GET /me/enrollments` (#167) ships.
 */
export const classesService = {
  list: async (query: ListClassesQuery) => {
    const { data } = await privateApi.get<ApiResponse<Paginated<ClassSummary>>>('/classes', {
      params: { ...query, openForEnrollment: true },
    });
    return data.result;
  },

  get: async (id: string) => {
    const { data } = await privateApi.get<ApiResponse<ClassDetail>>(`/classes/${encodeURIComponent(id)}`);
    return data.result;
  },

  listMyEnrollments: (user: Account) =>
    mockRequest(async () => {
      await seeded();
      return listMyEnrollments(actorOf(user));
    }),

  cancelEnrollment: (user: Account, id: string) =>
    mockRequest(async () => {
      await seeded();
      return cancelEnrollment(actorOf(user), id, () => walletService.balanceOfMine());
    }, 350),
};
