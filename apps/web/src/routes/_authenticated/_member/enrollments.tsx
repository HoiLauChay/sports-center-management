import { createFileRoute } from '@tanstack/react-router';
import { EnrollmentsPage } from '~/features/classes';

export const Route = createFileRoute('/_authenticated/_member/enrollments')({
  component: EnrollmentsPage,
});
