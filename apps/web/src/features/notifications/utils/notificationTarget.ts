import type { AppNotification } from '@sports-center/shared';
import type { NavigateOptions } from '@tanstack/react-router';

const TARGETS: Partial<Record<string, (id: string) => NavigateOptions>> = {
  INVOICE: (invoiceId) => ({ to: '/invoices/$invoiceId', params: { invoiceId } }),
};

export function notificationTarget({ referenceType, referenceId }: AppNotification) {
  if (!referenceType || !referenceId) return undefined;
  return TARGETS[referenceType]?.(referenceId);
}
