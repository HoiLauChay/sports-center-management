import { createFileRoute } from '@tanstack/react-router';
import { MembersPage } from '~/features/users';
import { parsePaginationSearch, parseStringSearch, type PaginationSearch } from '~/lib/search';

export interface MembersSearch extends PaginationSearch {
  q?: string;
}

export const Route = createFileRoute('/_authenticated/_receptionist/reception/members/')({
  validateSearch: (search: Record<string, unknown>): MembersSearch => ({
    ...parsePaginationSearch(search),
    q: parseStringSearch(search.q),
  }),
  component: MembersPage,
});
