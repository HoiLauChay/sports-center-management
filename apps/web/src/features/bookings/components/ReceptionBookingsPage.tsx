import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, DatePicker, Select } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { ErrorState, PageLoading } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { facilitiesQueryOptions, sportsQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { toApiError } from '~/lib/http-errors';
import { DATE_FORMAT, formatDayLabel, todayVN } from '~/lib/time';
import { useFacilitySchedules } from '../hooks/useBookings';
import { useSlotSelection } from '../hooks/useSlotSelection';
import { isValidSelection } from '../utils/slot-selection';
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
  const { selection, onSelect: setSelection, invalidated } = useSlotSelection(schedule.schedules);

  const currentSelection = isValidSelection(selection, schedule.schedules) ? selection : null;
  const selectedSlots = currentSelection
    ? schedule.schedules[currentSelection.facilityId]?.slots.slice(
        currentSelection.startIndex,
        currentSelection.startIndex + currentSelection.count,
      )
    : undefined;

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
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Select
            aria-label="Lọc bộ môn"
            className="!min-w-48"
            placeholder="Tất cả bộ môn"
            allowClear
            value={sportId}
            options={(sports.data ?? [])
              .filter((sport) => sport.isActive)
              .map((sport) => ({ value: sport.id, label: sport.name }))}
            onChange={(value) => {
              setSportId(value);
              setSelection(null);
            }}
          />
          <DatePicker
            aria-label="Ngày xem lịch"
            value={dayjs(date, DATE_FORMAT)}
            allowClear={false}
            format="DD/MM/YYYY"
            onChange={(value) => {
              if (value) {
                setDate(value.format(DATE_FORMAT));
                setSelection(null);
              }
            }}
          />
          <Button onClick={schedule.refetch} loading={schedule.isFetching}>
            Làm mới lịch
          </Button>
        </div>
        <p className="text-xs text-sc-muted" role="status">
          {schedule.updatedAt ? `Cập nhật lúc ${dayjs(schedule.updatedAt).format('HH:mm:ss')} · ` : ''}Tự cập nhật mỗi
          30 giây
        </p>
        {invalidated && (
          <Alert
            className="!mb-3"
            type="warning"
            showIcon
            title="Khung giờ đã chọn không còn khả dụng. Vui lòng chọn lại."
          />
        )}
        <h3 className="font-display text-[17px] font-bold uppercase">{formatDayLabel(date)}</h3>
        {!rows.length ? (
          <Alert type="info" showIcon title="Chưa có sân / phòng cho bộ môn này." />
        ) : (
          <>
            {schedule.error && <ErrorState message={toApiError(schedule.error).message} onRetry={schedule.refetch} />}
            <SlotGrid
              facilities={rows}
              schedules={schedule.schedules}
              loading={schedule.isLoading || Boolean(schedule.error)}
              selection={currentSelection}
              onSelect={setSelection}
            />
          </>
        )}
        {currentSelection && selectedSlots?.length && (
          <p className="mt-4 mb-0 text-sc-primary" role="status">
            {rows.find((facility) => facility.id === currentSelection.facilityId)?.name} · {selectedSlots[0]?.startTime}
            –{selectedSlots.at(-1)?.endTime} · {currentSelection.count} slot
          </p>
        )}
      </Card>
    </>
  );
}
