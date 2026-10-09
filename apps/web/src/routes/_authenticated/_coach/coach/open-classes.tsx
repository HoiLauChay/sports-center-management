import { createFileRoute } from '@tanstack/react-router';
import { CoachOpenClassesPage } from '~/features/classes';

export const Route = createFileRoute('/_authenticated/_coach/coach/open-classes')({
  component: CoachOpenClassesPage,
});
