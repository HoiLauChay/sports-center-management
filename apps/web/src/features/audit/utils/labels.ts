import type { AuditAction, AuditEntityType, AuditLog } from '@sports-center/shared';

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
  WALLET_TRANSACTION: 'Giao dịch ví',
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
  cancelledAt: 'Thời điểm hủy',
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
  id: 'Mã',
  createdAt: 'Thời điểm tạo',
  updatedAt: 'Thời điểm cập nhật',
  statusReason: 'Lý do đổi trạng thái',
  iconUrl: 'Biểu tượng',
  type: 'Loại',
  capacityPerSlot: 'Sức chứa / slot',
  pricePerSlot: 'Giá / slot',
  sportId: 'Bộ môn',
  sportIds: 'Bộ môn',
  totalSessions: 'Số buổi',
  thumbnailUrl: 'Ảnh khóa học',
  courseId: 'Khóa học',
  coachId: 'Huấn luyện viên',
  facilityId: 'Sân / phòng',
  minStudents: 'Sĩ số tối thiểu',
  maxStudents: 'Sĩ số tối đa',
  weeklySchedule: 'Lịch hằng tuần',
  sessions: 'Buổi học',
  approvedById: 'Người duyệt',
  approvedAt: 'Thời điểm duyệt',
  cancelReason: 'Lý do hủy',
  openTime: 'Giờ mở cửa',
  closeTime: 'Giờ đóng cửa',
  slotDurationMinutes: 'Thời lượng slot (phút)',
  maxAdvanceBookingDays: 'Đặt trước tối đa (ngày)',
  membershipExpiryWarningDays: 'Báo trước hết hạn gói (ngày)',
  topUpMinAmount: 'Nạp ví tối thiểu',
  invoiceExpiryMinutes: 'Hạn hóa đơn (phút)',
  updatedById: 'Người cập nhật',
  reviewNote: 'Ghi chú duyệt',
  reviewedById: 'Người duyệt',
  reviewedAt: 'Thời điểm duyệt',
  resolvedAccountId: 'Thành viên được gán',
  handledById: 'Người xử lý',
  handledAt: 'Thời điểm xử lý',
  paymentCode: 'Mã thanh toán',
  referenceCode: 'Mã tham chiếu',
};

export const auditFieldLabel = (field: string) => FIELD_LABEL[field] ?? field;

const SUMMARY_SKIPPED = new Set(['updatedAt']);

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Fields an entry touched: for an update only those whose value changed, since services log whole rows. */
export function changedFields(log: Pick<AuditLog, 'oldValues' | 'newValues'>) {
  const { oldValues, newValues } = log;
  const fields = [...new Set([...Object.keys(oldValues ?? {}), ...Object.keys(newValues ?? {})])];
  if (!oldValues || !newValues) return fields;
  return fields.filter((field) => !sameValue(oldValues[field], newValues[field]));
}

export const summaryFields = (log: Pick<AuditLog, 'oldValues' | 'newValues'>) =>
  changedFields(log).filter((field) => !SUMMARY_SKIPPED.has(field));
