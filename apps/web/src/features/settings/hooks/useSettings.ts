import { queryOptions, useQuery } from '@tanstack/react-query';
import { settingsService } from '../services/settings.service';

export const settingsQueryOptions = queryOptions({
  queryKey: ['settings'],
  queryFn: settingsService.get,
  staleTime: 5 * 60_000,
});

export function useSettings() {
  return useQuery(settingsQueryOptions);
}
