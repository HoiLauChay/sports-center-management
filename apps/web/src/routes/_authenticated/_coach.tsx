import { createFileRoute } from '@tanstack/react-router';
import { requireRole } from '~/lib/access';

export const Route = createFileRoute('/_authenticated/_coach')({
  beforeLoad: requireRole('COACH'),
});
