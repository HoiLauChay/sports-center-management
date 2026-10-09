import { createFileRoute } from '@tanstack/react-router';
import { CoachClassesPage } from '~/features/classes';

export const Route = createFileRoute('/_authenticated/_coach/coach/classes')({
  component: CoachClassesPage,
});
