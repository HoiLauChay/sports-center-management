import { createFileRoute } from '@tanstack/react-router';
import { CoachProfilePage } from '~/features/coaches';

export const Route = createFileRoute('/_authenticated/_member/coaches/$coachId')({
  component: CoachProfilePage,
});
