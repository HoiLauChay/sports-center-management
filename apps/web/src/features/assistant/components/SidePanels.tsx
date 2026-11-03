import type {
  AssistantOverview,
  AssistantQuota,
  CoachAssistantOverview,
  MemberAssistantOverview,
  ReceptionAssistantOverview,
} from '@sports-center/shared';
import { Link } from '@tanstack/react-router';
import { Popconfirm, Skeleton, Tooltip } from 'antd';
import {
  BookOpenCheck,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  Dumbbell,
  LayoutGrid,
  LifeBuoy,
  MessageCircle,
  MessagesSquare,
  ScanLine,
  ShieldCheck,
  Ticket,
  Trash2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { formatDate } from '~/lib/format';
import type { Conversation } from '../store/conversations';

const DAY_MS = 86_400_000;
const SHORT_WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const ddmm = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

const TONE = {
  sky: 'bg-[#dff1f7] text-[#1f7a99]',
  lime: 'bg-sc-lime text-sc-ink',
  green: 'bg-sc-primary-soft text-sc-primary',
  orange: 'bg-sc-accent-soft text-sc-accent',
};

function Tile({
  icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  tone: string;
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div title={hint} className="flex min-w-0 flex-col gap-1 rounded-xl bg-sc-paper px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${tone}`}>{icon}</span>
        <span className="truncate font-display text-[19px] leading-none font-extrabold uppercase">{value}</span>
      </div>
      <div className="line-clamp-2 text-[12.5px] leading-snug text-sc-muted">{label}</div>
    </div>
  );
}

function Detail({ title, lines }: { title: string; lines: { key: string; main: ReactNode; title?: string }[] }) {
  if (!lines.length) return null;
  return (
    <div className="px-4 pt-1 pb-3">
      <div className="mb-1 text-[12px] font-semibold tracking-[0.06em] text-sc-muted uppercase">{title}</div>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {lines.map(({ key, main, title: full }) => (
          <li key={key} title={full} className="truncate text-[13.5px] text-sc-ink-2">
            {main}
          </li>
        ))}
      </ul>
    </div>
  );
}

const Grid = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-2 gap-2 px-3 pt-3 pb-2">{children}</div>
);

function nextSessionTag(date: string, startTime: string) {
  const today = todayKey();
  if (date === today) return Number(startTime.slice(0, 2)) >= 17 ? 'Tối nay' : 'Hôm nay';
  if (Date.parse(date) - Date.parse(today) === DAY_MS) return 'Ngày mai';
  return null;
}

type SessionLine = CoachAssistantOverview['todaySessions'][number];

const sessionLines = (sessions: SessionLine[]) =>
  sessions.map((session) => ({
    key: session.id,
    title: `${session.startTime}–${session.endTime} · ${session.className} · ${session.facility}`,
    main: (
      <>
        <span className="font-semibold text-sc-ink tabular-nums">{session.startTime}</span> {session.className}
      </>
    ),
  }));

function MemberContent({ overview }: { overview: MemberAssistantOverview }) {
  const { membership, nextSession: next } = overview;
  const tag = next && nextSessionTag(next.date, next.startTime);
  return (
    <>
      <Grid>
        <Tile
          icon={<Ticket size={14} />}
          tone={TONE.lime}
          label={membership ? `Gói · còn ${membership.daysLeft} ngày` : 'Chưa có gói'}
          value={membership ? membership.name : '—'}
          hint={
            membership ? `còn ${membership.daysLeft} ngày · hết hạn ${formatDate(membership.endDate)}` : 'Chưa có gói'
          }
        />
        <Tile
          icon={<LayoutGrid size={14} />}
          tone={TONE.green}
          label="Lớp đang học"
          value={`${overview.classes.length} lớp`}
        />
        <Tile
          icon={<CalendarDays size={14} />}
          tone={TONE.sky}
          label={next ? `Buổi kế tiếp · ${tag ?? ddmm(next.date)}` : 'Không có buổi trong 2 tuần'}
          value={next ? `${SHORT_WEEKDAYS[new Date(`${next.date}T00:00:00Z`).getUTCDay()]} ${next.startTime}` : '—'}
          hint={next ? `${next.className} · ${next.facility}` : undefined}
        />
        <Tile
          icon={<Dumbbell size={14} />}
          tone={TONE.orange}
          label="Bài tập về nhà"
          value={`${overview.homework.length} bài`}
        />
      </Grid>
      <Detail
        title="Lớp"
        lines={overview.classes.map(({ id, name }) => ({
          key: id,
          title: name,
          main: next?.className === name ? `${name} · buổi tới ${next.startTime}` : name,
        }))}
      />
      <Detail
        title="Bài tập về nhà"
        lines={overview.homework.map((item) => ({
          key: item.classId,
          title: `${item.className} · buổi ${item.sessionNumber}: ${item.text}`,
          main: (
            <>
              <span className="font-semibold text-sc-ink">Buổi {item.sessionNumber}</span> {item.text}
            </>
          ),
        }))}
      />
    </>
  );
}

function CoachContent({ overview }: { overview: CoachAssistantOverview }) {
  return (
    <>
      <Grid>
        <Tile
          icon={<CalendarDays size={14} />}
          tone={TONE.sky}
          label="Dạy hôm nay"
          value={`${overview.todaySessions.length} buổi`}
        />
        <Tile
          icon={<LayoutGrid size={14} />}
          tone={TONE.green}
          label="Lớp phụ trách"
          value={`${overview.classes.length} lớp`}
        />
        <Tile
          icon={<ClipboardCheck size={14} />}
          tone={TONE.lime}
          label="Buổi thiếu điểm danh/ghi chú"
          value={`${overview.pendingSessions} buổi`}
          hint="Buổi đã dạy trong 14 ngày qua chưa điểm danh đủ hoặc chưa có ghi chú"
        />
        <Tile
          icon={<BookOpenCheck size={14} />}
          tone={TONE.orange}
          label="Học viên thiếu đánh giá"
          value={`${overview.missingReviews} HV`}
          hint="Học viên đã đến mốc giữa/cuối khóa mà chưa có đánh giá"
        />
      </Grid>
      <Detail title="Buổi dạy hôm nay" lines={sessionLines(overview.todaySessions)} />
      <Detail
        title="Lớp"
        lines={overview.classes.map(({ id, name, enrolled, maxStudents }) => ({
          key: id,
          title: name,
          main: (
            <>
              {name}{' '}
              <span className="text-sc-muted tabular-nums">
                · {enrolled}/{maxStudents}
              </span>
            </>
          ),
        }))}
      />
    </>
  );
}

function ReceptionContent({ overview }: { overview: ReceptionAssistantOverview }) {
  return (
    <>
      <Grid>
        <Tile
          icon={<ScanLine size={14} />}
          tone={TONE.lime}
          label="Check-in hôm nay"
          value={`${overview.checkinsToday} lượt`}
        />
        <Tile
          icon={<CalendarCheck size={14} />}
          tone={TONE.sky}
          label="Đặt sân hôm nay"
          value={`${overview.bookingsToday} lượt`}
        />
        <Tile
          icon={<LayoutGrid size={14} />}
          tone={TONE.green}
          label="Buổi học hôm nay"
          value={`${overview.sessionsToday.length} buổi`}
        />
        <Tile
          icon={<LifeBuoy size={14} />}
          tone={TONE.orange}
          label="Hỗ trợ đang chờ"
          value={`${overview.openSupport} yêu cầu`}
        />
      </Grid>
      <Detail title="Buổi học hôm nay" lines={sessionLines(overview.sessionsToday)} />
    </>
  );
}

function QuotaMeter({ quota }: { quota: AssistantQuota }) {
  const left = Math.max(0, quota.limit - quota.used);
  const ratio = quota.limit ? left / quota.limit : 0;
  const low = left <= 3;
  return (
    <div className="mx-3 mt-3 rounded-xl bg-sc-paper px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[12.5px] font-semibold tracking-[0.06em] text-sc-muted uppercase">
          <MessagesSquare size={14} className="text-sc-primary" />
          Lượt hỏi tháng này
        </span>
        <span className="text-[12.5px] text-sc-muted-2">Làm mới {ddmm(quota.resetsOn)}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span
          className={`font-display text-[26px] leading-none font-extrabold tabular-nums ${low ? 'text-sc-accent' : 'text-sc-ink'}`}
        >
          {left}
        </span>
        <span className="text-[13.5px] text-sc-muted">/ {quota.limit} lượt còn lại</span>
      </div>
      <div
        role="progressbar"
        aria-label="Lượt hỏi còn lại"
        aria-valuemin={0}
        aria-valuemax={quota.limit}
        aria-valuenow={left}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-sc-border-soft"
      >
        <div
          className={`h-full rounded-full ${low ? 'bg-sc-accent' : 'bg-sc-primary'}`}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
      {low && (
        <Link
          to="/memberships"
          className="mt-2 inline-block text-[13px] font-semibold !text-sc-primary underline underline-offset-2"
        >
          Nâng cấp gói để có thêm lượt
        </Link>
      )}
    </div>
  );
}

const READ_ONLY: Record<AssistantOverview['role'], string> = {
  MEMBER: 'Trợ lý chỉ đọc dữ liệu của bạn. Thanh toán hay đặt chỗ luôn cần bạn bấm xác nhận.',
  COACH: 'Trợ lý chỉ đọc dữ liệu các lớp bạn phụ trách. Điểm danh, chấm điểm, đánh giá vẫn do bạn thực hiện.',
  RECEPTIONIST: 'Trợ lý chỉ đọc dữ liệu. Check-in, bán hàng, nạp ví vẫn làm trên trang quầy.',
};

export function OverviewCard({
  overview,
  quota,
  loading,
}: {
  overview?: AssistantOverview;
  quota?: AssistantQuota | null;
  loading: boolean;
}) {
  const readOnly = overview && READ_ONLY[overview.role];
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-sc-border-soft bg-sc-surface lg:flex-1">
      <div className="flex shrink-0 items-center gap-2 px-5 pt-4 pb-1">
        <div className="text-[13px] font-bold tracking-[0.08em] uppercase">Trợ lý đang dùng</div>
        {readOnly && (
          <Tooltip title={readOnly}>
            <span
              tabIndex={0}
              aria-label={readOnly}
              className="flex size-6 cursor-help items-center justify-center rounded-md text-sc-primary hover:bg-sc-primary-soft"
            >
              <ShieldCheck size={15} />
            </span>
          </Tooltip>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {quota && <QuotaMeter quota={quota} />}
        {loading || !overview ? (
          <div className="p-5">
            <Skeleton active paragraph={{ rows: 4 }} title={false} />
          </div>
        ) : overview.role === 'COACH' ? (
          <CoachContent overview={overview} />
        ) : overview.role === 'RECEPTIONIST' ? (
          <ReceptionContent overview={overview} />
        ) : (
          <MemberContent overview={overview} />
        )}
      </div>
    </section>
  );
}

function when(iso: string) {
  const day = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const time = new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
  });
  const diff = Math.round((Date.parse(todayKey()) - Date.parse(day)) / DAY_MS);
  return diff === 0 ? `Hôm nay, ${time}` : diff === 1 ? `Hôm qua, ${time}` : ddmm(day);
}

export function RecentCard({
  conversations,
  activeId,
  onOpen,
  onDelete,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-sc-border-soft bg-sc-surface lg:max-h-[50%] lg:shrink-0">
      <div className="flex shrink-0 items-center gap-2 px-5 pt-4 pb-2">
        <div className="text-[13px] font-bold tracking-[0.08em] uppercase">Gần đây</div>
        {conversations.length > 0 && (
          <span className="rounded-full bg-sc-paper px-2 py-0.5 text-[12px] font-semibold text-sc-muted tabular-nums">
            {conversations.length}
          </span>
        )}
      </div>
      {conversations.length === 0 ? (
        <div className="flex items-center gap-3 px-5 pt-1 pb-5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sc-paper text-sc-muted">
            <MessagesSquare size={17} />
          </span>
          <p className="m-0 text-[13.5px] leading-snug text-sc-muted">
            Chưa có cuộc trò chuyện nào. Câu hỏi bạn gửi sẽ được lưu ở đây.
          </p>
        </div>
      ) : (
        <ul className="m-0 flex max-h-[264px] min-h-0 flex-1 list-none flex-col gap-0.5 overflow-y-auto px-2 pb-2 lg:max-h-none">
          {conversations.map(({ id, title, updatedAt, messages }) => {
            const active = id === activeId;
            const asked = messages.filter((message) => message.role === 'user').length;
            return (
              <li key={id} className="group relative">
                <button
                  type="button"
                  title={title}
                  aria-current={active || undefined}
                  onClick={() => onOpen(id)}
                  className={`flex w-full cursor-pointer items-start gap-3 rounded-xl border-0 py-2.5 pr-10 pl-3 text-left transition-colors ${
                    active ? 'bg-sc-primary-soft' : 'bg-transparent hover:bg-sc-paper'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${
                      active ? 'bg-sc-primary text-white' : 'bg-sc-paper text-sc-muted'
                    }`}
                  >
                    <MessageCircle size={15} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className={`line-clamp-2 text-[14px] leading-snug ${active ? 'font-semibold text-sc-ink' : 'text-sc-ink-2'}`}
                    >
                      {title}
                    </span>
                    <span className="text-[12px] text-sc-muted-2 tabular-nums">
                      {when(updatedAt)}
                      {asked > 0 && ` · ${asked} câu hỏi`}
                    </span>
                  </span>
                </button>
                <Popconfirm
                  title="Xóa cuộc trò chuyện này?"
                  description="Cuộc trò chuyện chỉ lưu trên trình duyệt này, xóa rồi không khôi phục được."
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true }}
                  placement="left"
                  onConfirm={() => onDelete(id)}
                >
                  <button
                    type="button"
                    aria-label={`Xóa cuộc trò chuyện "${title}"`}
                    className="absolute top-2.5 right-2 flex size-7 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-sc-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-sc-surface hover:text-sc-error focus-visible:opacity-100 [&.ant-popover-open]:opacity-100"
                  >
                    <Trash2 size={15} />
                  </button>
                </Popconfirm>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
