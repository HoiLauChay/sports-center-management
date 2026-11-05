import {
  BadgeCheck,
  Bell,
  CalendarDays,
  GraduationCap,
  IdCard,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  Receipt,
  School,
  ShoppingCart,
  Sparkles,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

/** Mirrors the member's real `/dashboard` (config/navigation.ts + dashboard/RoleDashboards.tsx). */

export const MOCK_USER = { name: 'Hoàng Thị Dung', initials: 'HD', role: 'Thành viên' };

export const MOCK_NAV: { title?: string; items: { label: string; icon: LucideIcon; active?: boolean }[] }[] = [
  {
    items: [
      { label: 'Tổng quan', icon: LayoutDashboard, active: true },
      { label: 'Thông báo', icon: Bell },
    ],
  },
  {
    title: 'Tập luyện',
    items: [
      { label: 'Đặt sân', icon: MapPin },
      { label: 'Lớp học', icon: School },
      { label: 'Lịch của tôi', icon: CalendarDays },
      { label: 'Lớp của tôi', icon: GraduationCap },
    ],
  },
  {
    title: 'Thanh toán',
    items: [
      { label: 'Gói thành viên', icon: BadgeCheck },
      { label: 'Gói của tôi', icon: IdCard },
      { label: 'Ví', icon: Wallet },
      { label: 'Giỏ hàng', icon: ShoppingCart },
      { label: 'Đơn hàng', icon: Receipt },
    ],
  },
  {
    items: [
      { label: 'Trợ lý AI', icon: Sparkles },
      { label: 'Hỗ trợ', icon: LifeBuoy },
    ],
  },
];

export const MOCK_STATS: { label: string; value: string; unit?: string; icon: LucideIcon }[] = [
  { label: 'Số dư ví', value: '1.250.000', unit: '₫', icon: Wallet },
  { label: 'All-access 3 tháng', value: 'Còn 47 ngày', icon: IdCard },
  { label: 'Lịch 14 ngày tới', value: '4', icon: CalendarDays },
];

export const MOCK_QUICK_LINKS: { label: string; icon: LucideIcon }[] = [
  { label: 'Đặt sân', icon: MapPin },
  { label: 'Đăng ký lớp', icon: School },
  { label: 'Nạp ví', icon: Wallet },
  { label: 'Gói thành viên', icon: BadgeCheck },
];

export type MockEventKind = 'BOOKING' | 'CLASS_SESSION';

export const MOCK_KIND_LABEL: Record<MockEventKind, string> = {
  BOOKING: 'Đặt sân / phòng',
  CLASS_SESSION: 'Buổi học',
};

/** `dayOffset` is counted from today so the dates always look current. */
export const MOCK_UPCOMING: {
  kind: MockEventKind;
  title: string;
  subtitle: string;
  dayOffset: number;
  time: string;
}[] = [
  { kind: 'BOOKING', title: 'Sân cầu lông 2', subtitle: 'Đặt sân / phòng', dayOffset: 0, time: '18:00–20:00' },
  { kind: 'CLASS_SESSION', title: 'Yoga tối', subtitle: 'Buổi 8 · Phòng Yoga 1', dayOffset: 1, time: '19:00–20:00' },
  {
    kind: 'CLASS_SESSION',
    title: 'Gym cơ bản K12',
    subtitle: 'Buổi 14 · Phòng Gym',
    dayOffset: 2,
    time: '06:30–07:30',
  },
  { kind: 'BOOKING', title: 'Sân tennis 1', subtitle: 'Đặt sân / phòng', dayOffset: 3, time: '17:00–18:00' },
];
