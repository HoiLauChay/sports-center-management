import { useQuery } from '@tanstack/react-query';
import { toApiError } from '~/lib/http-errors';
import { usersService } from '../services/users.service';

export const userDetailQueryKey = (id: string) => ['users', 'detail', id] as const;

export function useUserDetail(id: string) {
  const query = useQuery({
    queryKey: userDetailQueryKey(id),
    queryFn: () => usersService.get(id),
    retry: (failureCount, error) => toApiError(error).status !== 404 && failureCount < 2,
  });
  const notFound = query.isError && toApiError(query.error).status === 404;
  return { ...query, notFound };
}
