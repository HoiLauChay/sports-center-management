import { userIdParamsSchema } from '@sports-center/shared';
import { useQuery } from '@tanstack/react-query';
import { toApiError } from '~/lib/http-errors';
import { usersService } from '../services/users.service';

export const userDetailQueryKey = (id: string) => ['users', 'detail', id] as const;

export function useUserDetail(id: string) {
  const validId = userIdParamsSchema.safeParse({ id }).success;
  const query = useQuery({
    queryKey: userDetailQueryKey(id),
    queryFn: () => usersService.get(id),
    enabled: validId,
    retry: (failureCount, error) => {
      const status = toApiError(error).status;
      return (!status || status >= 500) && failureCount < 2;
    },
  });
  const notFound = !validId || (query.isError && toApiError(query.error).status === 404);
  return { ...query, notFound };
}
