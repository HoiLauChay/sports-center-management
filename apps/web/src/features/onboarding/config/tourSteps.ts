import type { Role } from '@sports-center/shared';
import type { NavPath } from '~/config/navigation';

export type TourRole = Extract<Role, 'MEMBER'>;

// Matches a `data-tour` attribute: nav links use their path, other anchors use a fixed key.
export type TourTarget = NavPath | 'account' | 'more';

export interface TourStepConfig {
  target?: TourTarget;
  title: string;
  description: string;
}

const WELCOME: Record<TourRole, TourStepConfig> = {
  MEMBER: {
    title: 'Chào mừng bạn đến Sports Center!',
    description: 'Cùng xem nhanh những chức năng chính để đặt sân, đăng ký lớp và quản lý gói tập của bạn.',
  },
};

const DASHBOARD: TourStepConfig = {
  target: '/dashboard',
  title: 'Tổng quan',
  description: 'Trang tổng quan hiển thị các số liệu và việc cần làm quan trọng nhất của bạn.',
};

const NOTIFICATIONS: TourStepConfig = {
  target: '/notifications',
  title: 'Thông báo',
  description: 'Mọi cập nhật về lịch, thanh toán và yêu cầu hỗ trợ đều được gửi về đây.',
};

const ACCOUNT: TourStepConfig = {
  target: 'account',
  title: 'Tài khoản của bạn',
  description: 'Cập nhật hồ sơ, đăng xuất hoặc mở lại hướng dẫn này bất cứ lúc nào từ menu tài khoản.',
};

export const ROLE_TOUR: Record<TourRole, TourStepConfig[]> = {
  MEMBER: [
    WELCOME.MEMBER,
    DASHBOARD,
    {
      target: '/bookings',
      title: 'Đặt sân',
      description: 'Chọn bộ môn, ngày và khung giờ còn trống để đặt sân theo lượt hoặc theo gói định kỳ.',
    },
    {
      target: '/classes',
      title: 'Lớp học',
      description: 'Xem các lớp đang mở đăng ký và ghi danh vào lớp phù hợp với bạn.',
    },
    {
      target: '/schedule',
      title: 'Lịch của tôi',
      description: 'Tất cả lượt đặt sân và buổi học của bạn được gom lại trên một lịch.',
    },
    {
      target: '/memberships',
      title: 'Gói thành viên',
      description: 'Mua gói thành viên để nhận ưu đãi khi đặt sân và đăng ký lớp.',
    },
    {
      target: '/wallet',
      title: 'Ví',
      description: 'Nạp tiền vào ví để thanh toán nhanh và theo dõi lịch sử giao dịch.',
    },
    {
      target: '/cart',
      title: 'Giỏ hàng',
      description: 'Các lượt đặt sân, lớp học và gói bạn chọn sẽ nằm trong giỏ cho đến khi thanh toán.',
    },
    {
      target: '/support',
      title: 'Hỗ trợ',
      description: 'Gặp vấn đề? Gửi yêu cầu hỗ trợ và theo dõi phản hồi từ trung tâm tại đây.',
    },
    NOTIFICATIONS,
    ACCOUNT,
  ],
};

export function isTourRole(role: Role): role is TourRole {
  return role in ROLE_TOUR;
}
