import type { Maintenance } from '@sports-center/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Alert, Button, Card, DatePicker, Segmented, Select } from 'antd';
import dayjs from 'dayjs';
import { ChevronLeft, ChevronRight, LayoutGrid, ListFilter, Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { ErrorState, PageLoading } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { facilitiesQueryOptions, sportsQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { useMaintenances } from '~/features/maintenance/hooks/useMaintenance';
import { VN_TIMEZONE } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { addDays, DATE_FORMAT, formatDayLabel, todayVN } from '~/lib/time';
import { useFacilitySchedules } from '../hooks/useBookings';
import { ReceptionBookingsTable } from './ReceptionBookingsTable';
import { SlotGrid } from './SlotGrid';

const formatMaintenanceWindow = (item: Maintenance) => {
  const start = dayjs(item.startAt).tz(VN_TIMEZONE);
  const end = dayjs(item.endAt).tz(VN_TIMEZONE);
  return start.format(DATE_FORMAT) === end.format(DATE_FORMAT)
    ? `${start.format('HH:mm')}–${end.format('HH:mm')} (${start.format('DD/MM')})`
    : `${start.format('HH:mm DD/MM')} → ${end.format('HH:mm DD/MM')}`;
};

/** Daily facility schedule & booking lookup directory for the reception desk; counter checkout lives at /reception/order. */
export function ReceptionBookingsPage() {
  const facilities = useQuery(facilitiesQueryOptions);
  const sports = useQuery(sportsQueryOptions);
  const [viewMode, setViewMode] = useState<'grid' | 'lookup'>('grid');
  const [date, setDate] = useState(todayVN());
  const [sportId, setSportId] = useState<string>();
  const rows = (facilities.data ?? []).filter(
    (facility) => facility.isActive && (!sportId || facility.sports.some((sport) => sport.id === sportId)),
  );
  const schedule = useFacilitySchedules(viewMode === 'grid' ? rows.map((facility) => facility.id) : [], date);
  const maintenances = useMaintenances({ from: date, to: date });
  const visibleMaintenances = (maintenances.data ?? []).filter(
    (item) => !sportId || rows.some((facility) => facility.id === item.facility.id),
  );

  if (facilities.isPending || sports.isPending) return <PageLoading />;
  if (facilities.isError || sports.isError) {
    return (
      <ErrorState
        message={toApiError(facilities.error ?? sports.error).message}
        onRetry={() => {
          void facilities.refetch();
          void sports.refetch();
        }}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Lịch sân / phòng"
        extra={
          <div className="flex flex-wrap items-center gap-2.5">
            <Segmented
              value={viewMode}
              onChange={(value) => setViewMode(value as 'grid' | 'lookup')}
              options={[
                {
                  value: 'grid',
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <LayoutGrid size={14} />
                      <span>Lưới lịch sân</span>
                    </span>
                  ),
                },
                {
                  value: 'lookup',
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <ListFilter size={14} />
                      <span>Tra cứu danh sách</span>
                    </span>
                  ),
                },
              ]}
            />
            <Link to="/reception/order">
              <Button type="primary" icon={<Plus size={16} />}>
                Đặt sân tại quầy
              </Button>
            </Link>
          </div>
        }
      />
      <Card
        className="overflow-hidden rounded-xl border border-slate-200/80 shadow-sm"
        styles={{ body: { padding: '20px 24px' } }}
      >
        {viewMode === 'lookup' ? (
          <ReceptionBookingsTable facilities={facilities.data ?? []} />
        ) : (
          <>
            {/* Controls Toolbar */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <Select
                  aria-label="Lọc bộ môn"
                  showSearch
                  optionFilterProp="label"
                  className="!w-44"
                  placeholder="Tất cả bộ môn"
                  allowClear
                  value={sportId}
                  options={(sports.data ?? [])
                    .filter((sport) => sport.isActive)
                    .map((sport) => ({ value: sport.id, label: sport.name }))}
                  onChange={setSportId}
                />

                {/* Quick date navigation */}
                <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50/70 p-0.5">
                  <Button
                    type="text"
                    size="small"
                    icon={<ChevronLeft size={16} />}
                    onClick={() => setDate(addDays(date, -1))}
                    title="Ngày trước"
                    className="!h-7 !w-7 !p-0"
                  />
                  <Button
                    type={date === todayVN() ? 'primary' : 'text'}
                    size="small"
                    onClick={() => setDate(todayVN())}
                    className="!h-7 text-[13.5px] font-medium"
                  >
                    Hôm nay
                  </Button>
                  <Button
                    type="text"
                    size="small"
                    icon={<ChevronRight size={16} />}
                    onClick={() => setDate(addDays(date, 1))}
                    title="Ngày sau"
                    className="!h-7 !w-7 !p-0"
                  />
                </div>

                <DatePicker
                  aria-label="Ngày xem lịch"
                  value={dayjs(date, DATE_FORMAT)}
                  allowClear={false}
                  format="DD/MM/YYYY"
                  className="!w-36"
                  onChange={(value) => {
                    if (value) setDate(value.format(DATE_FORMAT));
                  }}
                />

                <Button
                  icon={<RefreshCw size={14} className={schedule.isFetching ? 'animate-spin' : ''} />}
                  onClick={schedule.refetch}
                  loading={schedule.isFetching}
                >
                  Làm mới
                </Button>
              </div>
            </div>

            {visibleMaintenances.length > 0 && (
              <Alert
                type="warning"
                showIcon
                className="!mb-4"
                title={`Có ${visibleMaintenances.length} lịch bảo trì sân / phòng trong ngày đang xem`}
                description={
                  <ul className="m-0 pl-5 text-[14px]">
                    {visibleMaintenances.map((item) => (
                      <li key={item.id}>
                        <b>{item.facility.name}</b> · {formatMaintenanceWindow(item)} — {item.reason}
                      </li>
                    ))}
                  </ul>
                }
              />
            )}

            {/* Date status header */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="m-0 font-display text-[17px] font-bold text-sc-ink uppercase">{formatDayLabel(date)}</h3>
                {date === todayVN() && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[12.5px] font-semibold text-emerald-800">
                    Hôm nay
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[13.5px] text-sc-muted">
                <span className="inline-block size-2 animate-pulse rounded-full bg-emerald-500" />
                <span>
                  {schedule.updatedAt ? `Cập nhật lúc ${dayjs(schedule.updatedAt).format('HH:mm:ss')} · ` : ''}Tự động
                  làm mới mỗi 30s
                </span>
              </div>
            </div>

            {!rows.length ? (
              <Alert type="info" showIcon title="Chưa có sân / phòng cho bộ môn này." />
            ) : (
              <>
                {schedule.error && (
                  <ErrorState message={toApiError(schedule.error).message} onRetry={schedule.refetch} />
                )}
                <SlotGrid facilities={rows} schedules={schedule.schedules} loading={schedule.isLoading} />
              </>
            )}
          </>
        )}
      </Card>
    </>
  );
}
