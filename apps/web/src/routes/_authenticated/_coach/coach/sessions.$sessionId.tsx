import { createFileRoute } from '@tanstack/react-router';
import { CoachSessionPage } from '~/features/training';

export const Route = createFileRoute('/_authenticated/_coach/coach/sessions/$sessionId')({
  component: CoachSessionPage,
});
