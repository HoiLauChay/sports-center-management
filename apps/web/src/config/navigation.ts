import type { Role } from '@sports-center/shared';
import type { LinkProps } from '@tanstack/react-router';
import {
  Award,
  BadgeCheck,
  Bell,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  GraduationCap,
  HandCoins,
  History,
  IdCard,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  Receipt,
  ScanLine,
  School,
  Settings,
  ShoppingCart,
  Sparkles,
  Store,
  Ticket,
  Trophy,
  Users,
  Wallet,
  Wrench,
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
    { path: '/notifications', label: 'Thông báo', icon: Bell },
  ],
};

const ROLE_NAV: Record<Role, NavGroup[]> = {
  MEMBER: [
    {
      title: 'Tập luyện',
      items: [
        { path: '/bookings', label: 'Đặt sân', icon: MapPin },
        { path: '/classes', label: 'Lớp học', icon: School },
        { path: '/schedule', label: 'Lịch của tôi', icon: CalendarDays },
        { path: '/training', label: 'Lớp của tôi', icon: GraduationCap },
      ],
    },
    {
      title: 'Thanh toán',
      items: [
        { path: '/memberships', label: 'Gói thành viên', icon: BadgeCheck },
        { path: '/memberships/mine', label: 'Gói của tôi', icon: IdCard },
        { path: '/wallet', label: 'Ví', icon: Wallet },
        { path: '/cart', label: 'Giỏ hàng', icon: ShoppingCart },
        { path: '/orders', label: 'Đơn hàng', icon: Receipt },
      ],
    },
    {
      items: [
        { path: '/assistant', label: 'Trợ lý AI', icon: Sparkles },
        { path: '/support', label: 'Hỗ trợ', icon: LifeBuoy },
      ],
    },
  ],
  COACH: [
    {
      title: 'Giảng dạy',
      items: [
        { path: '/coach/classes', label: 'Lớp phụ trách', icon: School },
        { path: '/coach/schedule', label: 'Lịch dạy', icon: CalendarDays },
        { path: '/coach/open-classes', label: 'Lớp cần HLV', icon: ClipboardList },
        { path: '/coach/specializations', label: 'Chuyên môn', icon: Award },
      ],
    },
    { items: [{ path: '/coach/assistant', label: 'Trợ lý AI', icon: Sparkles }] },
  ],
  RECEPTIONIST: [
    {
      title: 'Quầy lễ tân',
      items: [
        { path: '/reception/checkin', label: 'Check-in', icon: ScanLine },
        { path: '/reception/order', label: 'Bán tại quầy', icon: Store },
        { path: '/reception/top-up', label: 'Nạp ví', icon: HandCoins },
        { path: '/reception/members', label: 'Thành viên', icon: Users },
        { path: '/reception/bookings', label: 'Lịch sân', icon: CalendarCheck },
        { path: '/reception/orders', label: 'Hóa đơn', icon: Receipt },
        { path: '/reception/support', label: 'Hỗ trợ', icon: LifeBuoy },
      ],
    },
  ],
  MANAGER: [
    {
      title: 'Vận hành',
      items: [
        { path: '/admin/reports', label: 'Báo cáo', icon: ChartColumn },
        { path: '/admin/orders', label: 'Hóa đơn', icon: Receipt },
        { path: '/admin/bank-transactions', label: 'Giao dịch ngân hàng', icon: Landmark },
        { path: '/admin/users', label: 'Người dùng', icon: Users },
        { path: '/admin/support', label: 'Hỗ trợ', icon: LifeBuoy },
        { path: '/admin/specializations', label: 'Duyệt chuyên môn', icon: Award },
        { path: '/admin/audit-logs', label: 'Lịch sử thao tác', icon: History },
      ],
    },
    {
      title: 'Danh mục',
      items: [
        { path: '/admin/sports', label: 'Bộ môn', icon: Trophy },
        { path: '/admin/facilities', label: 'Sân & phòng', icon: MapPin },
        { path: '/admin/courses', label: 'Khóa học', icon: BookOpen },
        { path: '/admin/classes', label: 'Lớp học', icon: School },
        { path: '/admin/memberships', label: 'Gói thành viên', icon: BadgeCheck },
        { path: '/admin/coupons', label: 'Mã giảm giá', icon: Ticket },
        { path: '/admin/maintenances', label: 'Bảo trì', icon: Wrench },
      ],
    },
    { items: [{ path: '/admin/settings', label: 'Cấu hình', icon: Settings }] },
  ],
};

const BOTTOM_NAV: Record<Role, [NavPath, string][]> = {
  MEMBER: [
    ['/dashboard', 'Tổng quan'],
    ['/bookings', 'Đặt sân'],
    ['/classes', 'Lớp học'],
    ['/schedule', 'Lịch'],
  ],
  COACH: [
    ['/dashboard', 'Tổng quan'],
    ['/coach/classes', 'Lớp dạy'],
    ['/coach/schedule', 'Lịch dạy'],
    ['/coach/open-classes', 'Cần HLV'],
  ],
  RECEPTIONIST: [
    ['/dashboard', 'Tổng quan'],
    ['/reception/checkin', 'Check-in'],
    ['/reception/order', 'Bán hàng'],
    ['/reception/bookings', 'Lịch sân'],
  ],
  MANAGER: [
    ['/dashboard', 'Tổng quan'],
    ['/admin/classes', 'Lớp học'],
    ['/admin/reports', 'Báo cáo'],
    ['/admin/bank-transactions', 'Giao dịch'],
  ],
};

export function bottomNavFor(role: Role): NavItem[] {
  const items = navGroupsFor(role).flatMap((group) => group.items);
  return BOTTOM_NAV[role].map(([path, label]) => ({ ...items.find((item) => item.path === path)!, label }));
}

export function navGroupsFor(role: Role): NavGroup[] {
  return [COMMON, ...ROLE_NAV[role]].filter((group) => group.items.length > 0);
}
