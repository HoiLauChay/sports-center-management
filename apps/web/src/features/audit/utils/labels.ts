import type { AuditAction, AuditEntityType } from '@sports-center/shared';

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
  APPROVE: 'Phê duyệt',
  REJECT: 'Từ chối',
  RESOLVE: 'Đối soát',
  IGNORE: 'Bỏ qua',
};

export const AUDIT_ACTION_COLOR: Record<AuditAction, string> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  APPROVE: 'cyan',
  REJECT: 'orange',
  RESOLVE: 'purple',
  IGNORE: 'default',
};

export const AUDIT_ENTITY_LABEL: Record<AuditEntityType, string> = {
  ACCOUNT: 'Tài khoản',
  MEMBER_PROFILE: 'Hồ sơ thành viên',
  COACH_PROFILE: 'Hồ sơ huấn luyện viên',
  RECEPTIONIST_PROFILE: 'Hồ sơ lễ tân',
  MANAGER_PROFILE: 'Hồ sơ quản lý',
  SPORT: 'Bộ môn',
  FACILITY: 'Sân & phòng',
  FACILITY_MAINTENANCE: 'Lịch bảo trì',
  COURSE: 'Khóa học',
  CLASS: 'Lớp học',
  CLASS_SESSION: 'Buổi học',
  CLASS_COACH_REGISTRATION: 'Phân công huấn luyện viên',
  COACH_SPECIALIZATION: 'Chuyên môn huấn luyện viên',
  MEMBERSHIP: 'Gói thành viên',
  MEMBER_MEMBERSHIP: 'Gói của thành viên',
  COUPON: 'Mã giảm giá',
  SYSTEM_SETTING: 'Cấu hình hệ thống',
  BANK_TRANSACTION: 'Giao dịch ngân hàng',
  INVOICE: 'Hóa đơn',
};

const FIELD_LABEL: Record<string, string> = {
  fullName: 'Họ tên',
  email: 'Email',
  phone: 'Số điện thoại',
  status: 'Trạng thái',
  role: 'Vai trò',
  name: 'Tên',
  description: 'Mô tả',
  price: 'Giá',
  isActive: 'Đang hoạt động',
  deletedAt: 'Thời điểm xóa',
  durationDays: 'Thời hạn (ngày)',
  bookingDiscountPct: 'Giảm giá đặt sân (%)',
  classDiscountPct: 'Giảm giá lớp học (%)',
  gymAccess: 'Quyền vào phòng gym',
  freeBookingSlotsPerMonth: 'Lượt đặt sân miễn phí / tháng',
  autoRenew: 'Tự động gia hạn',
  startDate: 'Ngày bắt đầu',
  endDate: 'Ngày kết thúc',
  staffNotes: 'Ghi chú nhân sự',
  fitnessGoals: 'Mục tiêu tập luyện',
  emergencyContact: 'Liên hệ khẩn cấp',
  avatarUrl: 'Ảnh đại diện',
  emailVerifiedAt: 'Thời điểm xác thực email',
  dateOfBirth: 'Ngày sinh',
  gender: 'Giới tính',
  address: 'Địa chỉ',
  note: 'Ghi chú',
  reason: 'Lý do',
  amount: 'Số tiền',
};

export const auditFieldLabel = (field: string) => FIELD_LABEL[field] ?? field;
