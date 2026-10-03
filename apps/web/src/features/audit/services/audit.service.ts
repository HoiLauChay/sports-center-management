import type { ApiResponse, AuditLog, CursorPaginated, ListAuditLogsQuery } from '@sports-center/shared';
import { privateApi } from '~/lib/http';

export const auditService = {
  list: async (params: ListAuditLogsQuery, signal?: AbortSignal) => {
    const { data } = await privateApi.get<ApiResponse<CursorPaginated<AuditLog>>>('/audit-logs', { params, signal });
    return data.result;
  },
};
