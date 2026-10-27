import type { AssistantRole } from '@sports-center/shared';
import {
  BookOpenCheck,
  Building2,
  CalendarDays,
  Clock,
  Dumbbell,
  LayoutGrid,
  Ticket,
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
/** Roles without an entry have no assistant page yet. */
export const ASSISTANT_CONFIG: Partial<Record<AssistantRole, AssistantConfig>> = {
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
      { label: 'Trung tâm', question: 'Trung tâm có những gói nào?', icon: Building2, tone: TONE.violet },
      { label: 'Giờ mở cửa', question: 'Trung tâm mở cửa mấy giờ?', icon: Clock, tone: TONE.paper },
    ],
    chips: [
      { label: 'Lịch tập', question: 'Lịch tập tuần này của tôi?', icon: CalendarDays },
      { label: 'Gói của tôi', question: 'Gói thành viên của tôi còn bao lâu?', icon: Ticket },
      { label: 'Bài tập', question: 'Bài tập về nhà của tôi là gì?', icon: BookOpenCheck },
    ],
    support: true,
  },
};
