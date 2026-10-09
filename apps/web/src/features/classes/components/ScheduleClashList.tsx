import type { ScheduleClash, ScheduleClashReason } from '@sports-center/shared';
import { Alert } from 'antd';
import { formatDate } from '~/lib/format';

const CLASH_TEXT: Record<ScheduleClashReason, string> = {
  CLOSED: 'phòng / sân đang tạm ngừng',
  PAST: 'buổi đã qua',
  OFF_GRID: 'giờ học không khớp lưới slot',
  MAINTENANCE: 'phòng / sân đang bảo trì',
  CLASS_SESSION: 'trùng buổi học khác',
  BOOKED: 'đã có lượt đặt sân',
  FULL: 'phòng / sân đã kín chỗ',
  COACH_BUSY: 'HLV đã có lịch',
  MEMBER_BUSY: 'học viên đã có lịch',
};

/** The time ranges a `SCHEDULE_CONFLICT` reported, one line each. */
export function ScheduleClashList({ conflicts }: { conflicts: ScheduleClash[] }) {
  if (conflicts.length === 0) return null;
  return (
    <Alert
      type="error"
      showIcon
      className="!mb-4"
      title="Lịch học bị trùng"
      description={
        <ul className="m-0 list-disc pl-4 text-xs">
          {conflicts.map((clash) => (
            <li key={`${clash.date}-${clash.startTime}-${clash.reason}`}>
              <strong>{formatDate(clash.date)}</strong> {clash.startTime}–{clash.endTime}:{' '}
              {clash.classSession ? `trùng buổi của lớp "${clash.classSession.className}"` : CLASH_TEXT[clash.reason]}
            </li>
          ))}
        </ul>
      }
    />
  );
}
