import { App, Button, DatePicker, Segmented, Space, Tooltip } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { CalendarRange, FileSpreadsheet, FileText, RotateCcw } from 'lucide-react';
import { DATE_FORMAT } from '~/lib/time';
import { useReportExport } from '../hooks/useReports';
import { GRANULARITIES, GRANULARITY_LABEL, REPORT_TAB_LABEL, type ReportRange, type ReportType } from '../types';
import { defaultRange } from '../utils';

const MAX_RANGE_SPAN_DAYS = 365;

const presets: Array<{ label: string; value: () => [Dayjs, Dayjs] }> = [
  { label: 'Hôm nay', value: () => [dayjs().startOf('day'), dayjs()] },
  { label: '7 ngày', value: () => [dayjs().subtract(6, 'day'), dayjs()] },
  { label: '30 ngày', value: () => [dayjs().subtract(29, 'day'), dayjs()] },
  { label: 'Tháng này', value: () => [dayjs().startOf('month'), dayjs()] },
  {
    label: 'Tháng trước',
    value: () => [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')],
  },
  { label: '3 tháng', value: () => [dayjs().subtract(2, 'month').startOf('month'), dayjs()] },
  { label: '6 tháng', value: () => [dayjs().subtract(5, 'month').startOf('month'), dayjs()] },
  { label: 'Năm nay', value: () => [dayjs().startOf('year'), dayjs()] },
];

interface ReportExportActionsProps {
  report: ReportType;
  range: ReportRange;
}

/** Excel (.xlsx) and PDF (.pdf) download buttons for any manager report tab. */
export function ReportExportActions({ report, range }: ReportExportActionsProps) {
  const { downloading, isExporting, exportReport } = useReportExport();
  const label = REPORT_TAB_LABEL[report].toLowerCase();

  return (
    <Space.Compact>
      <Tooltip title={`Tải báo cáo ${label} dạng bảng tính Excel (.xlsx)`}>
        <Button
          icon={<FileSpreadsheet size={16} />}
          loading={downloading === 'xlsx'}
          disabled={isExporting && downloading !== 'xlsx'}
          onClick={() => void exportReport(report, 'xlsx', range)}
        >
          Xuất Excel
        </Button>
      </Tooltip>
      <Tooltip title={`Tải báo cáo ${label} dạng tài liệu PDF (.pdf)`}>
        <Button
          icon={<FileText size={16} />}
          loading={downloading === 'pdf'}
          disabled={isExporting && downloading !== 'pdf'}
          onClick={() => void exportReport(report, 'pdf', range)}
        >
          Xuất PDF
        </Button>
      </Tooltip>
    </Space.Compact>
  );
}

interface ReportToolbarProps {
  range: ReportRange;
  onChange: (range: ReportRange) => void;
  report?: ReportType;
  showGranularity?: boolean;
}

/** Date range + optional day / week / month unit + Excel/PDF export shared across manager reports. */
export function ReportToolbar({ range, onChange, report, showGranularity = true }: ReportToolbarProps) {
  const { message } = App.useApp();
  const start = dayjs(range.from, DATE_FORMAT);
  const end = dayjs(range.to, DATE_FORMAT);
  const spanDays = Math.max(1, end.diff(start, 'day') + 1);
  const initial = defaultRange();
  const isDefault =
    range.from === initial.from &&
    range.to === initial.to &&
    (!showGranularity || range.granularity === initial.granularity);

  const handleRangeChange = (value: [Dayjs | null, Dayjs | null] | null) => {
    if (!value?.[0] || !value[1]) return;
    const [rawFrom, rawTo] = value;
    if (rawTo.diff(rawFrom, 'day') > MAX_RANGE_SPAN_DAYS) {
      const clampedFrom = rawTo.subtract(MAX_RANGE_SPAN_DAYS, 'day');
      message.warning('Khoảng thời gian báo cáo tối đa 366 ngày — đã tự động thu gọn ngày bắt đầu.');
      onChange({
        ...range,
        from: clampedFrom.format(DATE_FORMAT),
        to: rawTo.format(DATE_FORMAT),
      });
      return;
    }
    onChange({
      ...range,
      from: rawFrom.format(DATE_FORMAT),
      to: rawTo.format(DATE_FORMAT),
    });
  };

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sc-border-soft bg-sc-paper/45 px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <DatePicker.RangePicker
          allowClear={false}
          format="DD/MM/YYYY"
          value={[start, end]}
          presets={presets.map(({ label, value }) => ({ label, value: value() }))}
          maxDate={dayjs()}
          onChange={handleRangeChange}
        />
        {showGranularity && (
          <Segmented
            value={range.granularity}
            onChange={(granularity) => onChange({ ...range, granularity })}
            options={GRANULARITIES.map((value) => ({ value, label: GRANULARITY_LABEL[value] }))}
          />
        )}
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-[13.5px] font-medium text-sc-muted tabular-nums">
          <CalendarRange size={14} />
          {spanDays} ngày
        </span>
        {!isDefault && (
          <Tooltip title="Đặt lại về 30 ngày gần nhất">
            <Button
              type="text"
              size="small"
              icon={<RotateCcw size={14} />}
              onClick={() => onChange(showGranularity ? initial : { ...range, from: initial.from, to: initial.to })}
            >
              Mặc định
            </Button>
          </Tooltip>
        )}
      </div>

      {report && (
        <div className="flex items-center">
          <ReportExportActions report={report} range={range} />
        </div>
      )}
    </div>
  );
}
