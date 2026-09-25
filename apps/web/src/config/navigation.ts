import type { Role } from '@sports-center/shared';
import type { LinkProps } from '@tanstack/react-router';
import {
  // Award,
  // BadgeCheck,
  // Bell,
  // BookOpen,
  // CalendarCheck,
  // CalendarDays,
  // ChartColumn,
  // ClipboardList,
  // Dumbbell,
  // GraduationCap,
  // HandCoins,
  // History,
  // Landmark,
  LayoutDashboard,
  // LifeBuoy,
  // MapPin,
  // Receipt,
  // ScanLine,
  // School,
  // Settings,
  // ShoppingCart,
  // Store,
  // Ticket,
  // Trophy,
  Users,
  // Wallet,
  // Wrench,
  type LucideIcon,
} from 'lucide-react';

export type NavPath = Exclude<NonNullable<LinkProps['to']>, '.' | '..'>;

export interface NavItem {
  path: NavPath;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}

const COMMON: NavGroup = {
  items: [
    { path: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    // { path: '/notifications', label: 'Thông báo', icon: Bell },
  ],
};

const ROLE_NAV: Record<Role, NavGroup[]> = {
  MEMBER: [
    {
      title: 'Tập luyện',
      items: [
        // { path: '/bookings', label: 'Đặt sân', icon: MapPin },
        // { path: '/classes', label: 'Lớp học', icon: School },
        // { path: '/schedule', label: 'Lịch của tôi', icon: CalendarDays },
        // { path: '/enrollments', label: 'Lớp đã đăng ký', icon: GraduationCap },
        // { path: '/training', label: 'Kết quả tập luyện', icon: Dumbbell },
      ],
    },
    {
      title: 'Thanh toán',
      items: [
        // { path: '/memberships', label: 'Gói thành viên', icon: BadgeCheck },
        // { path: '/wallet', label: 'Ví', icon: Wallet },
        // { path: '/cart', label: 'Giỏ hàng', icon: ShoppingCart },
        // { path: '/orders', label: 'Hóa đơn', icon: Receipt },
      ],
    },
    // { items: [{ path: '/support', label: 'Hỗ trợ', icon: LifeBuoy }] },
  ],
  COACH: [
    {
      title: 'Giảng dạy',
      items: [
        // { path: '/coach/classes', label: 'Lớp đang dạy', icon: School },
        // { path: '/coach/schedule', label: 'Lịch dạy', icon: CalendarDays },
        // { path: '/coach/open-classes', label: 'Lớp cần HLV', icon: ClipboardList },
        // { path: '/coach/specializations', label: 'Chuyên môn', icon: Award },
      ],
    },
  ],
  RECEPTIONIST: [
    {
      title: 'Quầy lễ tân',
      items: [
        // { path: '/reception/checkin', label: 'Check-in', icon: ScanLine },
        // { path: '/reception/order', label: 'Bán tại quầy', icon: Store },
        // { path: '/reception/top-up', label: 'Nạp ví', icon: HandCoins },
        // { path: '/reception/members', label: 'Thành viên', icon: Users },
        // { path: '/reception/bookings', label: 'Lịch sân', icon: CalendarCheck },
        // { path: '/reception/orders', label: 'Hóa đơn', icon: Receipt },
        // { path: '/reception/support', label: 'Hỗ trợ', icon: LifeBuoy },
      ],
    },
  ],
  MANAGER: [
    {
      title: 'Vận hành',
      items: [
        // { path: '/admin/reports', label: 'Báo cáo', icon: ChartColumn },
        // { path: '/admin/bank-transactions', label: 'Giao dịch ngân hàng', icon: Landmark },
        { path: '/admin/users', label: 'Người dùng', icon: Users },
        // { path: '/admin/specializations', label: 'Duyệt chuyên môn', icon: Award },
        // { path: '/admin/audit-logs', label: 'Nhật ký thao tác', icon: History },
      ],
    },
    {
      title: 'Danh mục',
      items: [
        // { path: '/admin/sports', label: 'Bộ môn', icon: Trophy },
        // { path: '/admin/facilities', label: 'Sân & phòng', icon: MapPin },
        // { path: '/admin/courses', label: 'Khóa học', icon: BookOpen },
        // { path: '/admin/classes', label: 'Lớp học', icon: School },
        // { path: '/admin/memberships', label: 'Gói thành viên', icon: BadgeCheck },
        // { path: '/admin/coupons', label: 'Mã giảm giá', icon: Ticket },
        // { path: '/admin/maintenances', label: 'Bảo trì', icon: Wrench },
      ],
    },
    // { items: [{ path: '/admin/settings', label: 'Cấu hình', icon: Settings }] },
  ],
};

export function navGroupsFor(role: Role): NavGroup[] {
  return [COMMON, ...ROLE_NAV[role]].filter((group) => group.items.length > 0);
}
