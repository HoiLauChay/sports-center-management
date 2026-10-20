import { Link } from '@tanstack/react-router';
import { Tag } from 'antd';
import { ArrowRight } from 'lucide-react';
import { Highlight } from '~/components/ui/Highlight';
import { MoneyFigure } from '~/components/ui/MoneyFigure';
import { SportTag } from '~/components/ui/SportTag';
import { formatVND } from '~/lib/format';
import { parseDate } from '~/lib/time';
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
  const rows = [
    {
      label: 'HLV',
      value: item.coach?.fullName ? <Highlight keyword={keyword}>{item.coach.fullName}</Highlight> : 'Đang cập nhật',
    },
    { label: 'Lịch', value: weeklyText(item.weeklySchedule) },
    {
      label: 'Khai giảng',
      value: `${item.startDate ? parseDate(item.startDate).format('DD/MM') : 'Chưa có lịch'} · ${item.course.totalSessions} buổi`,
    },
    { label: 'Cơ sở', value: item.facility.name },
    { label: 'Sĩ số', value: `${item.enrolledCount}/${item.maxStudents} học viên` },
  ];
  return (
    <Link
      to="/classes/$classId"
      params={{ classId: item.id }}
      className="flex min-w-0 flex-col gap-4 rounded-xl border border-sc-border !bg-white p-5 !text-sc-ink no-underline shadow-[0_1px_2px_rgba(20,19,15,.03),0_2px_10px_rgba(20,19,15,.04)] [transition:border-color_0.15s,transform_0.15s,box-shadow_0.15s] hover:-translate-y-0.5 hover:!border-sc-primary-border hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <SportTag name={item.course.sport.name} />
        <Tag color={seatsLeft <= 0 ? 'default' : seatsLeft <= 3 ? 'warning' : 'success'} className="!m-0">
          {seatsLeft <= 0 ? 'Đã đầy' : `Còn ${seatsLeft} chỗ`}
        </Tag>
      </div>
      <h3 className="m-0 font-display text-[24px] leading-tight font-extrabold [overflow-wrap:anywhere] uppercase">
        <Highlight keyword={keyword}>{item.name}</Highlight>
      </h3>
      <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[15px]">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-sc-muted">{row.label}</dt>
            <dd className="m-0 font-medium [overflow-wrap:anywhere]">{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-auto flex flex-col gap-1.5 border-t border-sc-border-soft pt-4">
        {memberPrice < price && (
          <span className="text-[14px] whitespace-nowrap text-sc-muted tabular-nums">
            <span className="line-through">{formatVND(price)}</span> · giá thành viên
          </span>
        )}
        <div className="flex items-end justify-between gap-3">
          <span className="font-display text-[30px] leading-none font-extrabold whitespace-nowrap tabular-nums">
            <MoneyFigure amount={memberPrice} />
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[15px] font-semibold text-sc-primary">
            Xem lớp <ArrowRight size={16} />
          </span>
        </div>
      </div>
    </Link>
  );
}
