import type {
  Account,
  AccountSummary,
  ApiResponse,
  ChangeUserEmailBody,
  CreateUserBody,
  ListUsersQuery,
  Paginated,
  UpdateUserBody,
  UpdateUserRolesBody,
  UpdateUserStatusBody,
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

  update: async (id: string, payload: UpdateUserBody) => {
    const { data } = await privateApi.patch<ApiResponse<Account>>(`/users/${encodeURIComponent(id)}`, payload);
    return data.result;
  },

  updateStatus: async (id: string, payload: UpdateUserStatusBody) => {
    const { data } = await privateApi.patch<ApiResponse<Account>>(`/users/${encodeURIComponent(id)}/status`, payload);
    return data.result;
  },

  updateRoles: async (id: string, payload: UpdateUserRolesBody) => {
    const { data } = await privateApi.put<ApiResponse<Account>>(`/users/${encodeURIComponent(id)}/roles`, payload);
    return data.result;
  },

  changeEmail: async (id: string, payload: ChangeUserEmailBody) => {
    const { data } = await privateApi.patch<ApiResponse<Account>>(`/users/${encodeURIComponent(id)}/email`, payload);
    return data.result;
  },
};
