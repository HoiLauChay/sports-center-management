import { Link } from '@tanstack/react-router';
import { Skeleton } from 'antd';
import {
  ArrowRight,
  CalendarDays,
  LayoutGrid,
  MessageCircle,
  ScanLine,
  ShieldCheck,
  Ticket,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { formatDate } from '~/lib/format';
import { DAY_SHORT, isPast, parseDate, todayVN } from '~/lib/time';
import type { AssistantContext, AssistantSource } from '../types';

function Item({
  icon: Icon,
  tone,
  label,
  value,
  loading,
  failed,
  children,
}: {
  icon: LucideIcon;
  tone: string;
  label: string;
  value: string;
  loading: boolean;
  failed: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex gap-3 border-b border-sc-border-soft py-3.5 last:border-b-0">
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-[9px] ${tone}`}>
        <Icon size={16} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[12px] text-sc-muted">{label}</span>
        {loading ? (
          <Skeleton active title={{ width: '60%' }} paragraph={{ rows: 1, width: '90%' }} className="pt-1" />
        ) : failed ? (
          <span className="text-[12.5px] text-sc-muted-2">Không tải được dữ liệu</span>
        ) : (
          <>
            <span className="font-display text-[21px] leading-[22px] font-extrabold uppercase">{value}</span>
            {children}
          </>
        )}
      </div>
    </div>
  );
}

function MoreLink({
  to,
  children,
}: {
  to: '/memberships/mine' | '/schedule' | '/training' | '/classes';
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 text-[12.5px] font-semibold !text-sc-role-member no-underline"
    >
      {children}
      <ArrowRight size={13} />
    </Link>
  );
}

interface ContextPanelProps {
  context: AssistantContext;
  loading: Record<AssistantSource, boolean>;
  recent: string[];
  onPick: (question: string) => void;
}

export function ContextPanel({ context, loading, recent, onPick }: ContextPanelProps) {
  const { membership, classes, nextSession, checkInsThisMonth, unavailable } = context;
  const state = (source: AssistantSource) => ({ loading: loading[source], failed: unavailable.includes(source) });
  const isToday = nextSession?.date === todayVN() && !isPast(nextSession.date, nextSession.startTime);

  return (
    <aside className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-[20px] border border-sc-border-soft bg-white shadow-[0_8px_24px_-8px_rgba(20,19,15,0.08)]">
        <header className="border-b border-sc-border-soft px-[18px] pt-4 pb-3">
          <h2 className="m-0 font-display text-[12px] font-bold tracking-[0.08em] text-sc-ink-2 uppercase">
            Trợ lý đang dùng
          </h2>
          <p className="m-0 text-[12px] text-sc-muted-2">Dữ liệu trợ lý được phép đọc</p>
        </header>
        <div className="px-[18px] pb-1.5">
          <Item
            icon={Ticket}
            tone="bg-sc-lime text-sc-ink"
            label="Gói thành viên"
            {...state('membership')}
            value={membership?.name ?? 'Chưa có gói'}
          >
            {membership ? (
              <>
                <span className="mt-0.5 block h-[5px] overflow-hidden rounded-full bg-sc-paper-2">
                  <span
                    className="block h-full rounded-full bg-sc-role-member"
                    style={{ width: `${Math.round(membership.progress * 100)}%` }}
                  />
                </span>
                <span className="text-[12px] text-sc-muted">
                  còn {membership.daysLeft} ngày · hết hạn {formatDate(membership.endDate)}
                </span>
              </>
            ) : (
              <MoreLink to="/memberships/mine">Xem gói</MoreLink>
            )}
          </Item>

          <Item
            icon={LayoutGrid}
            tone="bg-sc-primary-soft text-sc-primary"
            label="Lớp đang học"
            {...state('classes')}
            value={`${classes.length} lớp`}
          >
            {classes.length > 0 ? (
              <span className="flex flex-wrap gap-[5px]">
                {classes.map((name) => (
                  <span
                    key={name}
                    className="rounded-md bg-sc-paper px-[7px] py-[3px] text-[11.5px] font-medium text-sc-ink-2"
                  >
                    {name}
                  </span>
                ))}
              </span>
            ) : (
              <MoreLink to="/classes">Tìm lớp</MoreLink>
            )}
          </Item>

          <Item
            icon={CalendarDays}
            tone="bg-[#e0f7fb] text-sc-role-member"
            label="Buổi kế tiếp"
            {...state('schedule')}
            value={
              nextSession ? `${DAY_SHORT[parseDate(nextSession.date).day()]} · ${nextSession.startTime}` : 'Chưa có'
            }
          >
            {nextSession ? (
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-[12.5px] text-sc-ink-2">{nextSession.title}</span>
                {isToday && (
                  <span className="rounded-full bg-sc-lime px-[7px] py-0.5 text-[11px] font-bold">Hôm nay</span>
                )}
              </span>
            ) : (
              <span className="text-[12px] text-sc-muted">Trong 2 tuần tới</span>
            )}
          </Item>

          <Item
            icon={ScanLine}
            tone="bg-sc-accent-soft text-sc-accent"
            label="Check-in tháng này"
            {...state('checkIns')}
            value={`${checkInsThisMonth} lần`}
          >
            <MoreLink to="/training">Kết quả tập luyện</MoreLink>
          </Item>
        </div>
        <footer className="flex gap-2.5 border-t border-sc-border-soft bg-[rgba(242,239,232,0.6)] px-[18px] py-3">
          <ShieldCheck size={15} className="mt-px shrink-0 text-sc-primary" />
          <p className="m-0 text-[12px] leading-[17px] text-sc-ink-2">
            Trợ lý chỉ đọc dữ liệu của bạn. Thanh toán hay đặt chỗ luôn cần bạn bấm xác nhận.
          </p>
        </footer>
      </section>

      <section className="overflow-hidden rounded-[20px] border border-sc-border-soft bg-white shadow-[0_8px_24px_-8px_rgba(20,19,15,0.08)]">
        <h2 className="m-0 px-[18px] pt-4 pb-2.5 font-display text-[12px] font-bold tracking-[0.08em] text-sc-ink-2 uppercase">
          Gần đây
        </h2>
        <div className="flex flex-col gap-0.5 px-2.5 pb-2.5">
          {recent.length === 0 ? (
            <p className="m-0 px-2 pb-2 text-[12.5px] text-sc-muted-2">Chưa có câu hỏi nào.</p>
          ) : (
            recent.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => onPick(question)}
                className="flex cursor-pointer items-center gap-2.5 rounded-[10px] [border:none] bg-transparent px-2 py-[9px] text-left [transition:background_0.15s] hover:bg-sc-paper"
              >
                <MessageCircle size={14} className="shrink-0 text-sc-muted-2" />
                <span className="truncate text-[13px] font-medium text-sc-ink-2">{question}</span>
              </button>
            ))
          )}
        </div>
      </section>
    </aside>
  );
}
