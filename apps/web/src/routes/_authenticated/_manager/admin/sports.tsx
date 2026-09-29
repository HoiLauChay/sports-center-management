import { createFileRoute } from '@tanstack/react-router';
import { SportsPage } from '~/features/catalog';

export const Route = createFileRoute('/_authenticated/_manager/admin/sports')({
  component: SportsPage,
});
