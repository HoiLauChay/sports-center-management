import dayjs from 'dayjs';
import { VN_TIMEZONE } from '~/lib/format';

/** A timestamp on two lines (time, then date) so table columns stay narrow. */
export function DateTimeCell({ value }: { value: string | Date }) {
  const at = dayjs(value).tz(VN_TIMEZONE);
  return (
    <div className="flex flex-col leading-tight whitespace-nowrap">
      <span className="tabular-nums">{at.format('HH:mm')}</span>
      <span className="text-[14.5px] text-sc-muted tabular-nums">{at.format('DD/MM/YYYY')}</span>
    </div>
  );
}
