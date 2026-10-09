import { createFileRoute } from '@tanstack/react-router';
import { CoachSpecializationsPage } from '~/features/specializations';

export const Route = createFileRoute('/_authenticated/_coach/coach/specializations')({
  component: CoachSpecializationsPage,
});
