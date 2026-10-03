import { useQuery } from '@tanstack/react-query';
import { usersService } from '~/features/users/services/users.service';

export function useAuditActors(q: string) {
  return useQuery({
    queryKey: ['users', 'audit-actors', q],
    queryFn: () => usersService.list({ q: q || undefined, page: 1, limit: 100 }),
    staleTime: 60_000,
  });
}
