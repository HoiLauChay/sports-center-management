import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import { DATE_FORMAT } from '~/lib/time';

/** A closed range of business dates (`YYYY-MM-DD`); either end may be left open. */
export interface DateRange {
  from?: string;
  to?: string;
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

/** Date range picker for list filters, working with plain `YYYY-MM-DD` strings. */
export function DateRangeFilter({ value, onChange, className }: DateRangeFilterProps) {
  return (
    <DatePicker.RangePicker
      allowEmpty={[true, true]}
      className={className}
      format="DD/MM/YYYY"
      placeholder={['Từ ngày', 'Đến ngày']}
      value={[value.from ? dayjs(value.from) : null, value.to ? dayjs(value.to) : null]}
      onChange={(dates) => onChange({ from: dates?.[0]?.format(DATE_FORMAT), to: dates?.[1]?.format(DATE_FORMAT) })}
    />
  );
}
