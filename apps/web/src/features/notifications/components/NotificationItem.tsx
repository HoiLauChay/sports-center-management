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

const TYPE_TONE: Record<NotificationType, string> = {
  PAYMENT: 'bg-sky-50 text-sky-700',
  MEMBERSHIP: 'bg-violet-50 text-violet-700',
  BOOKING: 'bg-emerald-50 text-emerald-700',
  CLASS: 'bg-amber-50 text-amber-700',
  TRAINING: 'bg-rose-50 text-rose-700',
  SUPPORT: 'bg-slate-100 text-slate-700',
  SYSTEM: 'bg-sc-paper text-sc-ink-2',
};

interface NotificationItemProps {
  notification: AppNotification;
  onOpen: (notification: AppNotification) => void;
}

export function NotificationItem({ notification, onOpen }: NotificationItemProps) {
  const Icon = TYPE_ICON[notification.type] ?? Bell;
  const unread = !notification.readAt;

  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      aria-label={`${unread ? 'Chưa đọc: ' : ''}${notification.title}`}
      className="group flex w-full cursor-pointer items-start gap-3 border-0 border-b border-b-sc-border-soft bg-transparent px-5 py-4 text-left [font:inherit] text-sc-ink [transition:background_0.15s] last:border-b-0 hover:bg-sc-paper"
    >
      <span
        className={`flex size-[38px] shrink-0 items-center justify-center rounded-lg ${TYPE_TONE[notification.type] ?? TYPE_TONE.SYSTEM}`}
      >
        <Icon size={18} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-start md:gap-6">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className={`text-[15px] ${unread ? 'font-bold text-sc-ink' : 'font-medium text-sc-ink-2'}`}>
              {notification.title}
            </span>
            {unread && <span aria-hidden className="size-2 shrink-0 rounded-full bg-sc-accent" />}
          </span>
          <span className="text-[15px] text-sc-muted wrap-anywhere">{notification.message}</span>
        </span>
        <span className="shrink-0 text-[14.5px] md:text-right">
          <span className="text-sc-muted-2 tabular-nums">{formatRelative(notification.createdAt)}</span>
        </span>
      </span>
    </button>
  );
}
