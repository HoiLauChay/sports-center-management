import { appUrl } from '~/configs/env';
import type { NotificationType } from '~/generated/prisma/client';
import { MONEY, renderEmail } from '~/templates/email/layout';
import { formatCenterDateTime } from '~/utils/time';

const TYPE_LABELS: Record<NotificationType, string> = {
  PAYMENT: 'Thanh toán',
  MEMBERSHIP: 'Gói thành viên',
  BOOKING: 'Đặt sân',
  CLASS: 'Lớp học',
  TRAINING: 'Huấn luyện',
  SUPPORT: 'Hỗ trợ',
  SHOP: 'Cửa hàng',
  SYSTEM: 'Hệ thống',
};

export interface NotificationEmail {
  type: NotificationType;
  title: string;
  message: string;
  createdAt: Date;
}

const PREHEADER_LENGTH = 140;

const preheaderOf = (message: string) => {
  const flat = message.replace(/\s+/g, ' ').trim();
  return flat.length > PREHEADER_LENGTH ? `${flat.slice(0, PREHEADER_LENGTH - 1)}…` : flat;
};

// Messages are free text; surface the amount as its own row only when there is exactly one, so it is unambiguous.
const detailsOf = (message: string, createdAt: Date) => {
  const amounts = message.match(MONEY) ?? [];
  return [
    ...(amounts.length === 1 ? [{ label: 'Số tiền', value: amounts[0]! }] : []),
    { label: 'Thời gian', value: formatCenterDateTime(createdAt) },
  ];
};

export const notificationTemplate = (fullName: string, { type, title, message, createdAt }: NotificationEmail) =>
  renderEmail({
    subject: `[Sports Center] ${title}`,
    preheader: preheaderOf(message),
    eyebrow: TYPE_LABELS[type],
    title,
    greeting: `Xin chào ${fullName},`,
    paragraphs: [message],
    details: detailsOf(message, createdAt),
    action: { label: 'Xem trong ứng dụng', url: `${appUrl}/notifications` },
  });
