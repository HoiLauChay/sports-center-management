import type { AppNotification, NotificationType } from '@sports-center/shared';
import { BadgeCheck, Bell, CalendarCheck, CreditCard, Dumbbell, LifeBuoy, School, type LucideIcon } from 'lucide-react';
import { formatRelative } from '~/lib/format';

const TYPE_ICON: Record<NotificationType, LucideIcon> = {
  PAYMENT: CreditCard,
  MEMBERSHIP: BadgeCheck,
  BOOKING: CalendarCheck,
  CLASS: School,
  TRAINING: Dumbbell,
  SUPPORT: LifeBuoy,
  SYSTEM: Bell,
};

interface NotificationItemProps {
  notification: AppNotification;
  compact?: boolean;
  onOpen: (notification: AppNotification) => void;
}

export function NotificationItem({ notification, compact = false, onOpen }: NotificationItemProps) {
  const Icon = TYPE_ICON[notification.type] ?? Bell;
  const unread = !notification.readAt;

  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      aria-label={`${unread ? 'Chưa đọc: ' : ''}${notification.title}`}
      className={`flex w-full cursor-pointer items-start gap-3 border-0 border-b border-b-sc-border-soft px-4 text-left [font:inherit] text-sc-ink [transition:background_0.15s] last:border-b-0 ${compact ? 'py-2.5' : 'py-3.5'} ${unread ? 'bg-sc-primary-soft hover:bg-[color-mix(in_srgb,var(--sc-primary-soft)_70%,var(--sc-paper))]' : 'bg-transparent hover:bg-sc-paper'}`}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg ${compact ? 'size-[30px]' : 'size-[34px]'} ${unread ? 'bg-sc-primary text-sc-lime' : 'bg-sc-paper text-sc-ink-2'}`}
      >
        <Icon size={compact ? 15 : 17} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={`text-[14px] ${unread ? 'font-bold' : 'font-medium'}`}>{notification.title}</span>
        <span className={`text-[13px] text-sc-muted ${compact ? 'truncate' : 'wrap-anywhere'}`}>
          {notification.message}
        </span>
        <span className="text-[12px] text-sc-muted-2">{formatRelative(notification.createdAt)}</span>
      </span>
      {unread && <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-sc-accent" />}
    </button>
  );
}
