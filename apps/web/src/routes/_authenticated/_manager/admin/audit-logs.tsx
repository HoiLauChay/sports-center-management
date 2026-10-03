import { createFileRoute } from '@tanstack/react-router';
import { AuditLogsPage } from '~/features/audit';

export const Route = createFileRoute('/_authenticated/_manager/admin/audit-logs')({
  component: AuditLogsPage,
});
