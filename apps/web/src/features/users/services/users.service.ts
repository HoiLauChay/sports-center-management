import type {
  Account,
  AccountSummary,
  ApiResponse,
  CreateUserBody,
  ListUsersQuery,
  Paginated,
} from '@sports-center/shared';
import { privateApi } from '~/lib/http';

export const usersService = {
  list: async (params: ListUsersQuery) => {
    const { data } = await privateApi.get<ApiResponse<Paginated<AccountSummary>>>('/users', { params });
    return data.result;
  },

  get: async (id: string) => {
    const { data } = await privateApi.get<ApiResponse<Account>>(`/users/${encodeURIComponent(id)}`);
    return data.result;
  },

  create: async (payload: CreateUserBody) => {
    const { data } = await privateApi.post<ApiResponse<Account>>('/users', payload);
    return data.result;
  },
};
