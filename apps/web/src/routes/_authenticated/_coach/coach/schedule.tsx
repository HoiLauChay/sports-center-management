import { createFileRoute } from '@tanstack/react-router';
import { CoachSchedulePage } from '~/features/schedule';

export const Route = createFileRoute('/_authenticated/_coach/coach/schedule')({
  component: CoachSchedulePage,
});
