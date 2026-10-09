import { Space, Tag } from 'antd';
import { DAY_SHORT, WEEK_ORDER } from '~/lib/time';
import type { GymClass, WeeklySlot } from '../types';
import { classStatusTag } from '../utils';

/** One tag per weekly slot, Monday first: "T3 18:00–19:30". */
export function WeeklyTags({ schedule }: { schedule: WeeklySlot[] }) {
  const ordered = WEEK_ORDER.flatMap((day) => schedule.filter((slot) => slot.dayOfWeek === day));
  return (
    <Space wrap size={[4, 4]}>
      {ordered.map((slot) => (
        <Tag key={`${slot.dayOfWeek}-${slot.startTime}`} className="!m-0">
          {DAY_SHORT[slot.dayOfWeek]} {slot.startTime}–{slot.endTime}
        </Tag>
      ))}
    </Space>
  );
}

export function ClassStatusTag({ item }: { item: Pick<GymClass, 'status' | 'derivedStatus'> }) {
  const tag = classStatusTag(item);
  return <Tag color={tag.color}>{tag.label}</Tag>;
}
