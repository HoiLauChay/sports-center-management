import {
  ArrowUpRight,
  CalendarDays,
  Clock,
  Dumbbell,
  LayoutGrid,
  ScanLine,
  Sparkles,
  Ticket,
  type LucideIcon,
} from 'lucide-react';

interface Suggestion {
  icon: LucideIcon;
  category: string;
  question: string;
  tone: string;
}

const SUGGESTIONS: Suggestion[] = [
  {
    icon: CalendarDays,
    category: 'Lịch tập',
    question: 'Buổi tập kế tiếp của tôi là khi nào?',
    tone: 'bg-[#e0f7fb] text-sc-role-member',
  },
  { icon: Ticket, category: 'Gói thành viên', question: 'Gói của tôi còn bao lâu?', tone: 'bg-sc-lime text-sc-ink' },
  {
    icon: LayoutGrid,
    category: 'Lớp học',
    question: 'Tôi đang học những lớp nào?',
    tone: 'bg-sc-primary-soft text-sc-primary',
  },
  {
    icon: ScanLine,
    category: 'Chuyên cần',
    question: 'Tháng này tôi đã check-in bao nhiêu lần?',
    tone: 'bg-sc-accent-soft text-sc-accent',
  },
  { icon: Dumbbell, category: 'Bài tập', question: 'Bài tập của tôi xem ở đâu?', tone: 'bg-[#ede9fe] text-[#6d28d9]' },
  { icon: Clock, category: 'Giờ mở cửa', question: 'Trung tâm mở cửa mấy giờ?', tone: 'bg-sc-paper text-sc-ink-2' },
];

interface WelcomeStateProps {
  firstName: string;
  onPick: (question: string) => void;
}

export function WelcomeState({ firstName, onPick }: WelcomeStateProps) {
  return (
    <div className="m-auto flex w-full max-w-[760px] flex-col items-center gap-6 py-4">
      <div className="flex flex-col items-center gap-3.5 text-center">
        <span className="flex size-[60px] items-center justify-center rounded-[20px] bg-sc-ink text-sc-lime shadow-[0_8px_28px_-4px_rgba(214,242,75,0.55)]">
          <Sparkles size={28} strokeWidth={1.8} />
        </span>
        <span className="font-display text-[12px] font-bold tracking-[0.12em] text-sc-muted uppercase">
          Trợ lý · Sports Center
        </span>
        <h2 className="m-0 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-display text-[34px] leading-[1.1] font-extrabold uppercase md:text-[44px]">
          <span>Chào {firstName}.</span>
          <span className="rounded-lg bg-sc-lime px-2.5">Hôm nay tập gì?</span>
        </h2>
        <p className="m-0 text-[15px] text-sc-muted">
          Tôi biết lịch, lớp, gói và bài tập của bạn — hỏi thẳng, không cần mở từng trang.
        </p>
      </div>

      <div className="grid w-full gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {SUGGESTIONS.map(({ icon: Icon, category, question, tone }) => (
          <button
            key={category}
            type="button"
            onClick={() => onPick(question)}
            className="group flex cursor-pointer flex-col gap-2.5 rounded-[14px] border border-sc-border-soft bg-white p-3.5 text-left shadow-[0_1px_2px_rgba(20,19,15,0.04)] [transition:all_0.15s] hover:-translate-y-px hover:border-sc-border hover:shadow-[0_8px_20px_-10px_rgba(20,19,15,0.2)]"
          >
            <span className="flex items-center gap-2">
              <span className={`flex size-7 items-center justify-center rounded-lg ${tone}`}>
                <Icon size={15} />
              </span>
              <span className="flex-1 font-display text-[11.5px] font-bold tracking-[0.06em] text-sc-muted uppercase">
                {category}
              </span>
              <ArrowUpRight size={14} className="text-sc-muted-2 group-hover:text-sc-ink" />
            </span>
            <span className="text-[14px] leading-[19px] font-semibold text-sc-ink">{question}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
