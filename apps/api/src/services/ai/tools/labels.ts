interface ToolLabel {
  doing: string;
  source?: string;
}

export const TOOL_LABELS: Record<string, ToolLabel> = {
  get_center_info: { doing: 'Đang xem thông tin trung tâm', source: 'Thông tin trung tâm' },
  list_facilities: { doing: 'Đang xem danh sách sân', source: 'Danh sách sân' },
  check_availability: { doing: 'Đang kiểm tra lịch sân', source: 'Lịch sân' },
  find_available_slots: { doing: 'Đang tìm sân trống', source: 'Lịch sân' },
  get_policies: { doing: 'Đang tra quy định', source: 'Quy định trung tâm' },
  list_memberships: { doing: 'Đang xem các gói thành viên', source: 'Gói thành viên' },
  list_open_classes: { doing: 'Đang tìm lớp đang mở', source: 'Lớp đang mở' },

  my_schedule: { doing: 'Đang xem lịch của bạn', source: 'Lịch của bạn' },
  my_enrollments: { doing: 'Đang xem lớp của bạn', source: 'Lớp của bạn' },
  my_training: { doing: 'Đang xem kế hoạch tập', source: 'Kế hoạch tập' },
  my_progress: { doing: 'Đang xem tiến độ của bạn', source: 'Tiến độ của bạn' },
  my_wallet: { doing: 'Đang xem ví của bạn', source: 'Ví của bạn' },
  my_memberships: { doing: 'Đang xem gói của bạn', source: 'Gói của bạn' },
  my_bookings: { doing: 'Đang xem sân bạn đã đặt', source: 'Sân đã đặt' },
  draft_support_request: { doing: 'Đang soạn yêu cầu hỗ trợ' },
  compare_memberships: { doing: 'Đang so sánh các gói', source: 'Lịch sử chi tiêu' },
  propose_cart_item: { doing: 'Đang kiểm tra giá và chỗ trống', source: 'Giá hiện tại' },

  coach_schedule: { doing: 'Đang xem lịch dạy', source: 'Lịch dạy' },
  coach_classes: { doing: 'Đang xem lớp phụ trách', source: 'Lớp phụ trách' },
  class_roster: { doing: 'Đang xem danh sách học viên', source: 'Danh sách học viên' },
  student_progress: { doing: 'Đang xem tiến độ học viên', source: 'Tiến độ học viên' },
  coach_todo: { doing: 'Đang xem việc còn thiếu', source: 'Việc còn thiếu' },
  propose_attendance: { doing: 'Đang chuẩn bị điểm danh' },

  find_members: { doing: 'Đang tìm hội viên', source: 'Hồ sơ hội viên' },
  member_overview: { doing: 'Đang xem hồ sơ hội viên', source: 'Hồ sơ hội viên' },
  bookings_on: { doing: 'Đang xem lượt đặt sân', source: 'Lượt đặt sân' },
  sessions_on: { doing: 'Đang xem buổi học', source: 'Buổi học trong ngày' },
  checkins_on: { doing: 'Đang xem lượt check-in', source: 'Lượt check-in' },
  find_classes: { doing: 'Đang tìm lớp', source: 'Danh sách lớp' },
  class_enrollments: { doing: 'Đang xem ghi danh của lớp', source: 'Ghi danh lớp' },
  support_queue: { doing: 'Đang xem yêu cầu hỗ trợ', source: 'Yêu cầu hỗ trợ' },
};
