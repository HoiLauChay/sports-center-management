import { createFileRoute } from '@tanstack/react-router';
import { SchedulePage } from '~/features/schedule';

export const Route = createFileRoute('/_authenticated/_member/schedule')({
  component: SchedulePage,
});
