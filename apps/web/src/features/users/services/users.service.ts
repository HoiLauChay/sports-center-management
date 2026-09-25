import type { AccountSummary, ApiResponse, ListUsersQuery, Paginated } from '@sports-center/shared';
import { privateApi } from '~/lib/http';

export const usersService = {
  list: async (params: ListUsersQuery) => {
    const { data } = await privateApi.get<ApiResponse<Paginated<AccountSummary>>>('/users', { params });
    return data.result;
  },
};
