import type { Account } from '@sports-center/shared';
import { queryOptions, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import axios from 'axios';
import { authService } from './services/auth.service';

export const sessionQueryOptions = queryOptions({
  queryKey: ['auth', 'session'],
  queryFn: async (): Promise<Account | null> => {
    try {
      return await authService.me();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) return null;
      throw err;
    }
  },
  staleTime: Infinity,
  retry: false,
});

export function useSession() {
  return useSuspenseQuery(sessionQueryOptions).data;
}

export function useCurrentUser(): Account {
  const user = useSession();
  if (!user) throw new Error('useCurrentUser must be used inside an authenticated route');
  return user;
}

export function useIsLoggedIn() {
  return useQuery(sessionQueryOptions).data != null;
}
