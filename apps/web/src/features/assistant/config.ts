import type { AssistantRole } from '@sports-center/shared';
import {
  BookOpenCheck,
  CalendarCheck,
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  Clock,
  Dumbbell,
  Landmark,
  LayoutGrid,
  LifeBuoy,
  MapPin,
  PiggyBank,
  ScanLine,
  Ticket,
  TrendingDown,
  UserRoundCheck,
  UserSearch,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { NavPath } from '~/config/navigation';

export interface Suggestion {
  label: string;
  question: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon chip. */
  tone: string;
}

export interface Chip {
  label: string;
  question: string;
  icon: LucideIcon;
}

export interface AssistantConfig {
  breadcrumb: { label: string; to: NavPath };
  description: string;
  headline: string;
  intro: string;
  placeholder: string;
  /** The reminder under the input that answers may be wrong. */
  caution: string;
  suggestions: Suggestion[];
  chips: Chip[];
  /** Members can turn a chat into a support request; staff handle those requests instead. */
  support: boolean;
}

const TONE = {
  sky: 'bg-[#dff1f7] text-[#1f7a99]',
  lime: 'bg-sc-lime text-sc-ink',
  green: 'bg-sc-primary-soft text-sc-primary',
  orange: 'bg-sc-accent-soft text-sc-accent',
  violet: 'bg-[#ece6f8] text-[#6a4bb5]',
  paper: 'bg-sc-paper-2 text-sc-ink-2',
};

/** What the assistant page says and suggests for each role it serves. */
export const ASSISTANT_CONFIG: Record<AssistantRole, AssistantConfig> = {
  MEMBER: {
    breadcrumb: { label: 'Hỗ trợ', to: '/support' },
    description:
      'Hỏi về lịch tập, bài tập, gói thành viên hoặc dịch vụ của trung tâm — trợ lý trả lời dựa trên dữ liệu tài khoản của bạn.',
    headline: 'Hôm nay tập gì?',
    intro: 'Tôi biết lịch, lớp, gói và bài tập của bạn — hỏi thẳng, không cần mở từng trang.',
    placeholder: 'Hỏi về lịch tập, gói, lớp hoặc bài tập của bạn...',
    caution: 'Trợ lý có thể nhầm — luôn kiểm tra lại trước khi thanh toán hoặc đặt chỗ.',
    suggestions: [
      { label: 'Lịch tập', question: 'Lịch tập tuần này của tôi?', icon: CalendarDays, tone: TONE.sky },
      { label: 'Gói thành viên', question: 'Gói của tôi còn bao lâu?', icon: Ticket, tone: TONE.lime },
      { label: 'Lớp học', question: 'Có lớp Yoga nào còn chỗ không?', icon: LayoutGrid, tone: TONE.green },
      { label: 'Bài tập', question: 'Bài tập về nhà của tôi là gì?', icon: Dumbbell, tone: TONE.orange },
      { label: 'Tư vấn gói', question: 'Tôi nên mua gói nào cho tiết kiệm?', icon: PiggyBank, tone: TONE.violet },
      { label: 'Giờ mở cửa', question: 'Trung tâm mở cửa mấy giờ?', icon: Clock, tone: TONE.paper },
    ],
    chips: [
      { label: 'Lịch tập', question: 'Lịch tập tuần này của tôi?', icon: CalendarDays },
      { label: 'Gói của tôi', question: 'Gói thành viên của tôi còn bao lâu?', icon: Ticket },
      { label: 'Tư vấn gói', question: 'Tôi nên mua gói nào cho tiết kiệm?', icon: PiggyBank },
      { label: 'Bài tập', question: 'Bài tập về nhà của tôi là gì?', icon: BookOpenCheck },
    ],
    support: true,
  },
  COACH: {
    breadcrumb: { label: 'Giảng dạy', to: '/coach/classes' },
    description: 'Hỏi về lịch dạy, học viên, tiến độ và việc còn thiếu — trợ lý chỉ đọc dữ liệu các lớp bạn phụ trách.',
    headline: 'Hôm nay dạy gì?',
    intro: 'Tôi biết lịch dạy, học viên và tiến độ các lớp của bạn — hỏi thẳng, không cần mở từng lớp.',
    placeholder: 'Hỏi về lịch dạy, học viên hoặc việc còn thiếu...',
    caution: 'Trợ lý có thể nhầm — kiểm tra lại trên trang lớp trước khi điểm danh hay đánh giá.',
    suggestions: [
      { label: 'Lịch dạy', question: 'Tuần này tôi dạy những buổi nào?', icon: CalendarDays, tone: TONE.sky },
      { label: 'Việc còn thiếu', question: 'Tôi còn thiếu việc gì không?', icon: ClipboardCheck, tone: TONE.lime },
      { label: 'Chuyên cần', question: 'Học viên nào vắng nhiều nhất?', icon: Users, tone: TONE.green },
      { label: 'Tiến độ', question: 'Học viên nào có điểm thấp nhất gần đây?', icon: TrendingDown, tone: TONE.orange },
      { label: 'Đánh giá', question: 'Ai còn thiếu đánh giá giữa khóa?', icon: BookOpenCheck, tone: TONE.violet },
      { label: 'Phòng tập', question: 'Phòng Gym tối thứ 7 còn trống không?', icon: MapPin, tone: TONE.paper },
    ],
    chips: [
      { label: 'Hôm nay', question: 'Hôm nay tôi dạy những buổi nào?', icon: CalendarDays },
      { label: 'Việc còn thiếu', question: 'Tôi còn thiếu việc gì không?', icon: ClipboardCheck },
      { label: 'Học viên', question: 'Tóm tắt tình hình học viên các lớp của tôi', icon: Users },
    ],
    support: false,
  },
  RECEPTIONIST: {
    breadcrumb: { label: 'Quầy lễ tân', to: '/reception/checkin' },
    description:
      'Tra hội viên, lịch sân, buổi học và việc đang chờ ở quầy — trợ lý chỉ đọc, mọi thao tác vẫn làm trên trang quầy.',
    headline: 'Quầy hôm nay thế nào?',
    intro: 'Tôi tra được hội viên, lịch sân, buổi học và check-in — hỏi thẳng, không cần mở từng trang.',
    placeholder: 'Hỏi về hội viên, lịch sân, buổi học...',
    caution: 'Trợ lý có thể nhầm — kiểm tra lại trên trang quầy trước khi thu tiền hay check-in.',
    suggestions: [
      {
        label: 'Hội viên',
        question: 'Hội viên Đặng Khánh Linh còn bao nhiêu tiền trong ví?',
        icon: UserSearch,
        tone: TONE.sky,
      },
      { label: 'Lịch sân', question: 'Tối nay 19h sân cầu lông nào còn trống?', icon: CalendarCheck, tone: TONE.lime },
      { label: 'Buổi học', question: 'Hôm nay có những buổi học nào?', icon: LayoutGrid, tone: TONE.green },
      { label: 'Check-in', question: 'Hôm nay đã có bao nhiêu lượt check-in?', icon: ScanLine, tone: TONE.orange },
      { label: 'Hỗ trợ', question: 'Có bao nhiêu yêu cầu hỗ trợ đang chờ?', icon: LifeBuoy, tone: TONE.violet },
      {
        label: 'Tư vấn gói',
        question: 'Hội viên Đặng Khánh Linh nên mua gói nào cho tiết kiệm?',
        icon: PiggyBank,
        tone: TONE.paper,
      },
    ],
    chips: [
      { label: 'Buổi học hôm nay', question: 'Hôm nay có những buổi học nào?', icon: LayoutGrid },
      { label: 'Lịch sân', question: 'Hôm nay có những lượt đặt sân nào?', icon: CalendarCheck },
      { label: 'Hỗ trợ', question: 'Có yêu cầu hỗ trợ nào đang chờ không?', icon: LifeBuoy },
    ],
    support: false,
  },
  MANAGER: {
    breadcrumb: { label: 'Báo cáo', to: '/admin/reports' },
    description:
      'Hỏi về doanh thu, sân, lớp, hội viên và việc đang chờ duyệt — trợ lý đọc báo cáo và chuẩn bị sẵn thao tác để bạn xác nhận.',
    headline: 'Trung tâm tuần này thế nào?',
    intro: 'Tôi đọc được báo cáo, việc tồn và giờ cao điểm — hỏi thẳng, không cần mở từng trang báo cáo.',
    placeholder: 'Hỏi về doanh thu, sân, lớp, hội viên hoặc việc đang chờ...',
    caution: 'Trợ lý có thể nhầm — đối chiếu với trang báo cáo trước khi ra quyết định.',
    suggestions: [
      { label: 'Tóm tắt tuần', question: 'Tóm tắt tình hình tuần trước giúp tôi', icon: ChartColumn, tone: TONE.sky },
      { label: 'Việc đang chờ', question: 'Tôi đang có việc gì cần xử lý?', icon: ClipboardCheck, tone: TONE.lime },
      { label: 'Sân vắng', question: 'Sân nào vắng nhất tháng này?', icon: MapPin, tone: TONE.green },
      { label: 'Giờ vắng', question: 'Khung giờ nào vắng nhất để chạy khuyến mãi?', icon: Clock, tone: TONE.orange },
      {
        label: 'Duyệt lớp',
        question: 'Có lớp nào chờ duyệt không? Kiểm tra giúp tôi',
        icon: UserRoundCheck,
        tone: TONE.violet,
      },
      { label: 'Giao dịch', question: 'Giao dịch ngân hàng nào chưa khớp, của ai?', icon: Landmark, tone: TONE.paper },
    ],
    chips: [
      { label: 'Doanh thu', question: 'Doanh thu tháng này so với tháng trước?', icon: ChartColumn },
      { label: 'Việc đang chờ', question: 'Tôi đang có việc gì cần xử lý?', icon: ClipboardCheck },
      { label: 'HLV', question: 'Khối lượng dạy của các HLV tháng này?', icon: Users },
    ],
    support: false,
  },
};
