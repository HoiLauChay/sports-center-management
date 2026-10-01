import type { MembershipPackage } from '@sports-center/shared';
import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { membershipsService } from '../services/memberships.service';

export const membershipsQueryOptions = queryOptions({
  queryKey: ['memberships'],
  queryFn: membershipsService.list,
});

export function cacheMembershipPackage(queryClient: QueryClient, membership: MembershipPackage) {
  queryClient.setQueryData<MembershipPackage[]>(membershipsQueryOptions.queryKey, (packages) => {
    if (!packages) return packages;
    const exists = packages.some(({ id }) => id === membership.id);
    return exists
      ? packages.map((current) => (current.id === membership.id ? membership : current))
      : [...packages, membership];
  });
}

export function removeCachedMembershipPackage(queryClient: QueryClient, id: string) {
  queryClient.setQueryData<MembershipPackage[]>(membershipsQueryOptions.queryKey, (packages) =>
    packages?.filter((membership) => membership.id !== id),
  );
}
