import { DatePicker, Segmented } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { DATE_FORMAT } from '~/lib/time';
import { GRANULARITIES, GRANULARITY_LABEL, type ReportRange } from '../types';

const presets: Array<{ label: string; value: () => [Dayjs, Dayjs] }> = [
  { label: 'Hôm nay', value: () => [dayjs().startOf('day'), dayjs()] },
  { label: '7 ngày', value: () => [dayjs().subtract(6, 'day'), dayjs()] },
  { label: '30 ngày', value: () => [dayjs().subtract(29, 'day'), dayjs()] },
  { label: 'Tháng này', value: () => [dayjs().startOf('month'), dayjs()] },
  {
    label: 'Tháng trước',
    value: () => [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')],
  },
  { label: '6 tháng', value: () => [dayjs().subtract(5, 'month').startOf('month'), dayjs()] },
  { label: 'Năm nay', value: () => [dayjs().startOf('year'), dayjs()] },
];

interface ReportToolbarProps {
  range: ReportRange;
  onChange: (range: ReportRange) => void;
}

/** Date range + day / week / month unit shared by the revenue and wallet reports. */
export function ReportToolbar({ range, onChange }: ReportToolbarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <DatePicker.RangePicker
        allowClear={false}
        format="DD/MM/YYYY"
        value={[dayjs(range.from, DATE_FORMAT), dayjs(range.to, DATE_FORMAT)]}
        presets={presets.map(({ label, value }) => ({ label, value: value() }))}
        maxDate={dayjs()}
        onChange={(value) => {
          if (value?.[0] && value[1]) {
            onChange({ ...range, from: value[0].format(DATE_FORMAT), to: value[1].format(DATE_FORMAT) });
          }
        }}
      />
      <Segmented
        value={range.granularity}
        onChange={(granularity) => onChange({ ...range, granularity })}
        options={GRANULARITIES.map((value) => ({ value, label: GRANULARITY_LABEL[value] }))}
      />
    </div>
  );
}
