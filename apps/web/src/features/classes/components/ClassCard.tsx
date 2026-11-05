import { Link } from '@tanstack/react-router';
import { ArrowRight, CalendarDays, Clock, MapPin, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { Highlight } from '~/components/ui/Highlight';
import { MoneyFigure } from '~/components/ui/MoneyFigure';
import { formatVND } from '~/lib/format';
import { parseDate } from '~/lib/time';
import type { ClassSummary } from '../types';
import { weeklyText } from '../utils';

interface ClassCardProps {
  item: ClassSummary;
  keyword?: string;
  discountPct?: number;
}

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-sc-muted-2">{icon}</span>
      <span className="truncate">{children}</span>
    </li>
  );
}

export function ClassCard({ item, keyword, discountPct = 0 }: ClassCardProps) {
  const seatsLeft = Math.max(0, item.maxStudents - item.enrolledCount);
  const full = seatsLeft === 0;
  const fillPct = item.maxStudents ? Math.min(100, Math.round((item.enrolledCount / item.maxStudents) * 100)) : 0;
  const seatTone = full ? 'text-sc-muted' : seatsLeft <= 3 ? 'text-sc-accent' : 'text-sc-primary';
  const barTone = full ? 'bg-sc-muted-2' : seatsLeft <= 3 ? 'bg-sc-accent' : 'bg-sc-primary';
  const price = item.course.price;
  const memberPrice = price - Math.round((price * discountPct) / 100);

  return (
    <Link
      to="/classes/$classId"
      params={{ classId: item.id }}
      className="group flex min-w-0 flex-col rounded-2xl border border-sc-border !bg-white p-5 !text-sc-ink no-underline [transition:border-color_0.15s,box-shadow_0.15s] hover:!border-sc-primary-border hover:shadow-[0_6px_20px_rgba(20,19,15,0.07)]"
    >
      <span className="text-[13px] font-semibold text-sc-primary">{item.course.sport.name}</span>
      <h3 className="m-0 mt-1 font-display text-[22px] leading-[1.1] font-extrabold [overflow-wrap:anywhere] uppercase">
        <Highlight keyword={keyword}>{item.name}</Highlight>
      </h3>

      <div className="mt-3 flex items-center gap-2 text-[16px] font-semibold tabular-nums">
        <Clock size={16} className="shrink-0 text-sc-primary" />
        {weeklyText(item.weeklySchedule)}
      </div>

      <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0 text-[14.5px] text-sc-ink-2">
        <Meta icon={<UserRound size={15} />}>
          {item.coach?.fullName ? <Highlight keyword={keyword}>{item.coach.fullName}</Highlight> : 'HLV đang cập nhật'}
        </Meta>
        <Meta icon={<MapPin size={15} />}>{item.facility.name}</Meta>
        <Meta icon={<CalendarDays size={15} />}>
          {item.startDate ? `Khai giảng ${parseDate(item.startDate).format('DD/MM')}` : 'Chưa có lịch khai giảng'} ·{' '}
          {item.course.totalSessions} buổi
        </Meta>
      </ul>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2 text-[13.5px]">
          <span className={`font-semibold ${seatTone}`}>{full ? 'Đã đầy' : `Còn ${seatsLeft} chỗ`}</span>
          <span className="text-sc-muted tabular-nums">
            {item.enrolledCount}/{item.maxStudents} học viên
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sc-paper-2" aria-hidden>
          <div className={`h-full rounded-full ${barTone}`} style={{ width: `${fillPct}%` }} />
        </div>
      </div>

      <div className="min-h-4 flex-1" />
      <div className="flex items-end justify-between gap-3 border-t border-sc-border-soft pt-4">
        <div className="flex min-w-0 flex-col gap-1">
          {memberPrice < price && (
            <span className="flex items-center gap-2 text-[13px] text-sc-muted tabular-nums">
              <span className="rounded-md bg-sc-lime px-1.5 py-px font-semibold text-sc-ink">−{discountPct}%</span>
              <span className="line-through">{formatVND(price)}</span>
            </span>
          )}
          <span className="font-display text-[26px] leading-none font-extrabold whitespace-nowrap tabular-nums">
            <MoneyFigure amount={memberPrice} />
          </span>
        </div>
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sc-primary-soft text-sc-primary transition-colors group-hover:bg-sc-primary group-hover:text-white"
        >
          <ArrowRight size={18} />
        </span>
      </div>
    </Link>
  );
}
