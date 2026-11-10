import { ACCOUNT_STATUSES, ASSIGNABLE_ROLES, type ListUsersQuery } from '@sports-center/shared';
import { createFileRoute } from '@tanstack/react-router';
import { UsersPage } from '~/features/users';
import { parseEnumSearch, parsePaginationSearch, parseStringSearch } from '~/lib/search';

export const Route = createFileRoute('/_authenticated/_manager/admin/users/')({
  validateSearch: (search: Record<string, unknown>): Partial<ListUsersQuery> => ({
    ...parsePaginationSearch(search),
    q: parseStringSearch(search.q),
    // Managers are not listed here, so the filter only knows the roles a manager assigns.
    role: parseEnumSearch(ASSIGNABLE_ROLES, search.role),
    status: parseEnumSearch(ACCOUNT_STATUSES, search.status),
  }),
  component: UsersPage,
});
