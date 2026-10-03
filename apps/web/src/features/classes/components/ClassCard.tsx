import { Link } from '@tanstack/react-router';
import { Tag } from 'antd';
import { CalendarDays, Clock, MapPin, UserRound, Users } from 'lucide-react';
import { formatDate, formatVND } from '~/lib/format';
import type { GymClass } from '../types';
import { weeklyText } from '../utils';

export function ClassCard({ item }: { item: GymClass }) {
  const seatsLeft = item.maxStudents - item.enrolledCount;
  return (
    <Link
      to="/classes/$classId"
      params={{ classId: item.id }}
      className="flex min-w-0 flex-col gap-3 rounded-xl border border-sc-border-soft bg-white p-5 !text-sc-ink no-underline shadow-[0_1px_2px_rgba(20,19,15,.03),0_2px_10px_rgba(20,19,15,.04)] [transition:border-color_0.15s,transform_0.15s] hover:-translate-y-0.5 hover:border-sc-primary-border"
    >
      <div className="flex items-start justify-between gap-2">
        <Tag color="processing" className="!m-0">
          {item.course.sport.name}
        </Tag>
        <Tag color={seatsLeft <= 3 ? 'warning' : 'success'} className="!m-0">
          Còn {seatsLeft} chỗ
        </Tag>
      </div>
      <h3 className="m-0 font-display text-[22px] leading-tight font-extrabold uppercase [overflow-wrap:anywhere]">
        {item.name}
      </h3>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px] text-sc-muted">
        <li className="flex items-center gap-2">
          <UserRound size={14} /> HLV {item.coach?.fullName ?? 'đang cập nhật'}
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
      <div className="mt-auto font-display text-[28px] leading-none font-extrabold tabular-nums">
        {formatVND(item.course.price)}
      </div>
    </Link>
  );
}
