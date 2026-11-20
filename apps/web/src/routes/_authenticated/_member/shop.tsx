import { createFileRoute } from '@tanstack/react-router';
import { ShopPage } from '~/features/shop';
import { parseStringSearch } from '~/lib/search';

export const Route = createFileRoute('/_authenticated/_member/shop')({
  validateSearch: (search: Record<string, unknown>): { sportId?: string } => ({
    sportId: parseStringSearch(search.sportId),
  }),
  component: ShopPage,
});
