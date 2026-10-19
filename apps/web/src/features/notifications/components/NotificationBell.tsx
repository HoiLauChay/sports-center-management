import { useNavigate } from '@tanstack/react-router';
import { Badge } from 'antd';
import { Bell } from 'lucide-react';
import { IconButton } from '~/components/ui/IconButton';
import { PATHS } from '~/constants/paths';
import { useNotificationSummary } from '../hooks/useNotifications';

export function NotificationBell() {
  const navigate = useNavigate();
  const summary = useNotificationSummary();
  const unread = summary.data?.unreadCount ?? 0;

  return (
    <IconButton
      aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
      onClick={() => void navigate({ to: PATHS.notifications })}
    >
      <Badge count={unread} size="small" overflowCount={99} offset={[4, -4]}>
        <Bell size={18} />
      </Badge>
    </IconButton>
  );
}
