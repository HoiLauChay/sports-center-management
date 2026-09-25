import { ACCOUNT_STATUSES, ROLES, type ListUsersQuery } from '@sports-center/shared';
import { createFileRoute } from '@tanstack/react-router';
import { UsersPage } from '~/features/users';
import { parseEnumSearch, parsePaginationSearch, parseStringSearch } from '~/lib/search';

export const Route = createFileRoute('/_authenticated/_manager/admin/users')({
  validateSearch: (search: Record<string, unknown>): ListUsersQuery => ({
    ...parsePaginationSearch(search),
    q: parseStringSearch(search.q),
    role: parseEnumSearch(ROLES, search.role),
    status: parseEnumSearch(ACCOUNT_STATUSES, search.status),
  }),
  component: UsersPage,
});
