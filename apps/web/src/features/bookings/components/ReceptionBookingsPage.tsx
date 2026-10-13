import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Alert, Button, Card, DatePicker, Select } from 'antd';
import dayjs from 'dayjs';
import { ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { ErrorState, PageLoading } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { facilitiesQueryOptions, sportsQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { toApiError } from '~/lib/http-errors';
import { addDays, DATE_FORMAT, formatDayLabel, todayVN } from '~/lib/time';
import { useFacilitySchedules } from '../hooks/useBookings';
import { SlotGrid } from './SlotGrid';

/** Daily facility schedule for the reception desk; counter checkout lives at /reception/order. */
export function ReceptionBookingsPage() {
  const facilities = useQuery(facilitiesQueryOptions);
  const sports = useQuery(sportsQueryOptions);
  const [date, setDate] = useState(todayVN());
  const [sportId, setSportId] = useState<string>();
  const rows = (facilities.data ?? []).filter(
    (facility) => facility.isActive && (!sportId || facility.sports.some((sport) => sport.id === sportId)),
  );
  const schedule = useFacilitySchedules(
    rows.map((facility) => facility.id),
    date,
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
        description="Xem tình trạng sân và phòng theo ngày trước khi đặt tại quầy."
      />
      <Card
        className="overflow-hidden rounded-xl border border-slate-200/80 shadow-sm"
        styles={{ body: { padding: '20px 24px' } }}
      >
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
                className="!h-7 text-xs font-medium"
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

          <div className="flex items-center gap-3">
            <Link to="/reception/order">
              <Button type="primary" icon={<Plus size={16} />}>
                Đặt sân tại quầy
              </Button>
            </Link>
          </div>
        </div>

        {/* Date status header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-[17px] font-bold uppercase text-sc-ink m-0">{formatDayLabel(date)}</h3>
            {date === todayVN() && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                Hôm nay
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-sc-muted">
            <span className="inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              {schedule.updatedAt ? `Cập nhật lúc ${dayjs(schedule.updatedAt).format('HH:mm:ss')} · ` : ''}Tự động làm
              mới mỗi 30s
            </span>
          </div>
        </div>

        {!rows.length ? (
          <Alert type="info" showIcon title="Chưa có sân / phòng cho bộ môn này." />
        ) : (
          <>
            {schedule.error && <ErrorState message={toApiError(schedule.error).message} onRetry={schedule.refetch} />}
            <SlotGrid facilities={rows} schedules={schedule.schedules} loading={schedule.isLoading} />
          </>
        )}
      </Card>
    </>
  );
}
