import type { Role } from '@sports-center/shared';
import type { NavPath } from '~/config/navigation';
import { useMemberCart } from '~/features/checkout';
import { useNotificationSummary } from '~/features/notifications';

export function useNavCounts(role: Role): Partial<Record<NavPath, number>> {
  const notifications = useNotificationSummary();
  const { count } = useMemberCart();
  return {
    '/notifications': notifications.data?.unreadCount ?? 0,
    ...(role === 'MEMBER' && { '/cart': count }),
  };
}
