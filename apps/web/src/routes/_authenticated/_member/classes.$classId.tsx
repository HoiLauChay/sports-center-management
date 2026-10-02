import { createFileRoute } from '@tanstack/react-router';
import { ClassDetailPage } from '~/features/classes';

export const Route = createFileRoute('/_authenticated/_member/classes/$classId')({
  component: ClassDetailPage,
});
