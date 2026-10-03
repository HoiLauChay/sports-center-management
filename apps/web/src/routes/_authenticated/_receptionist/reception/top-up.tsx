import { createFileRoute } from '@tanstack/react-router';
import { CounterTopUpPage } from '~/features/reception';
import { parseStringSearch } from '~/lib/search';

export const Route = createFileRoute('/_authenticated/_receptionist/reception/top-up')({
  validateSearch: (search: Record<string, unknown>): { memberId?: string } => ({
    memberId: parseStringSearch(search.memberId),
  }),
  component: CounterTopUpPage,
});
