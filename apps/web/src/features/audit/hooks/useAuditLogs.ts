import type { AuditLog, ListAuditLogsQuery } from '@sports-center/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { auditService } from '../services/audit.service';

export type AuditLogFilters = Omit<ListAuditLogsQuery, 'cursor' | 'limit'>;

const PAGE_SIZE = 20;

export function useAuditLogs(filters: AuditLogFilters) {
  const query = useInfiniteQuery({
    queryKey: ['audit-logs', filters],
    queryFn: ({ pageParam, signal }) => auditService.list({ ...filters, cursor: pageParam, limit: PAGE_SIZE }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

  const items = useMemo(() => {
    const byId = new Map<string, AuditLog>();
    for (const page of query.data?.pages ?? []) {
      for (const item of page.items) if (!byId.has(item.id)) byId.set(item.id, item);
    }
    return [...byId.values()];
  }, [query.data]);

  return { ...query, items };
}
