import { createFileRoute } from '@tanstack/react-router';
import { CoachClassPage } from '~/features/training';

export const Route = createFileRoute('/_authenticated/_coach/coach/classes/$classId')({
  component: CoachClassPage,
});
