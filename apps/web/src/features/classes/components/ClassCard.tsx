import { Link } from '@tanstack/react-router';
import { Tag } from 'antd';
import { ArrowRight, CalendarDays, Clock, MapPin, UserRound, Users } from 'lucide-react';
import { Highlight } from '~/components/ui/Highlight';
import { SportTag } from '~/components/ui/SportTag';
import { formatDate, formatVND } from '~/lib/format';
import type { GymClass } from '../types';
import { weeklyText } from '../utils';

interface ClassCardProps {
  item: GymClass;
  keyword?: string;
  discountPct?: number;
}

export function ClassCard({ item, keyword, discountPct = 0 }: ClassCardProps) {
  const seatsLeft = item.maxStudents - item.enrolledCount;
  const price = item.course.price;
  const memberPrice = price - Math.round((price * discountPct) / 100);
  return (
    <Link
      to="/classes/$classId"
      params={{ classId: item.id }}
      className="flex min-w-0 flex-col gap-3 rounded-xl border border-sc-border !bg-white p-5 !text-sc-ink no-underline shadow-[0_1px_2px_rgba(20,19,15,.03),0_2px_10px_rgba(20,19,15,.04)] [transition:border-color_0.15s,transform_0.15s,box-shadow_0.15s] hover:-translate-y-0.5 hover:!border-sc-primary-border hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <SportTag name={item.course.sport.name} />
        <Tag color={seatsLeft <= 3 ? 'warning' : 'success'} className="!m-0">
          Còn {seatsLeft} chỗ
        </Tag>
      </div>
      <h3 className="m-0 font-display text-[22px] leading-tight font-extrabold uppercase [overflow-wrap:anywhere]">
        <Highlight keyword={keyword}>{item.name}</Highlight>
      </h3>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px] text-sc-muted">
        <li className="flex items-center gap-2">
          <UserRound size={14} /> HLV{' '}
          {item.coach?.fullName ? <Highlight keyword={keyword}>{item.coach.fullName}</Highlight> : 'đang cập nhật'}
        </li>
        <li className="flex items-center gap-2">
          <Clock size={14} /> {weeklyText(item.weeklySchedule)}
        </li>
        <li className="flex items-center gap-2">
          <CalendarDays size={14} />
          {item.startDate ? `Khai giảng ${formatDate(item.startDate)}` : 'Chưa có lịch'} · {item.course.totalSessions}{' '}
          buổi
        </li>
        <li className="flex items-center gap-2">
          <MapPin size={14} /> {item.facility.name}
        </li>
        <li className="flex items-center gap-2">
          <Users size={14} /> {item.enrolledCount}/{item.maxStudents} học viên
        </li>
      </ul>
      <div className="mt-auto flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          {memberPrice < price && (
            <span className="text-[13px] text-sc-muted tabular-nums">
              <span className="line-through">{formatVND(price)}</span> · giá thành viên
            </span>
          )}
          <span className="font-display text-[28px] leading-none font-extrabold tabular-nums">
            {formatVND(memberPrice)}
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-[13.5px] font-semibold text-sc-primary">
          Xem lớp <ArrowRight size={15} />
        </span>
      </div>
    </Link>
  );
}
