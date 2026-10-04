import type { Facility } from '@sports-center/shared';
import { Tooltip } from 'antd';
import { formatVND } from '~/lib/format';
import type { FacilitySchedule, FacilitySlot, SlotSelection, SlotStatus } from '../types';
import { isSelectableSlot, isValidSelection, selectSlot } from '../utils/slot-selection';

const STATUS_LABEL: Record<SlotStatus, string> = {
  AVAILABLE: 'Trống',
  PARTIAL: 'Còn chỗ',
  FULL: 'Đã đầy',
  CLASS: 'Có lớp',
  MAINTENANCE: 'Bảo trì',
  CLOSED: 'Đóng',
};

const CELL_STYLE: Record<SlotStatus, string> = {
  AVAILABLE: 'bg-white hover:bg-sc-primary-soft hover:border-sc-primary-border cursor-pointer',
  PARTIAL: 'bg-[#fff7e0] border-[#f3dfa3] hover:bg-[#ffefbd] cursor-pointer text-[#8a6100]',
  FULL: 'bg-sc-paper-2 text-sc-muted-2 cursor-not-allowed [background-image:repeating-linear-gradient(135deg,transparent_0_5px,rgba(20,19,15,.06)_5px_6px)]',
  CLASS: 'bg-sc-primary-soft text-sc-primary cursor-not-allowed',
  MAINTENANCE: 'bg-[#fbe9e4] text-sc-accent cursor-not-allowed',
  CLOSED: 'bg-sc-paper text-sc-muted-2 cursor-not-allowed opacity-70',
};

const LEGEND_STYLE: Record<SlotStatus, string> = {
  AVAILABLE: 'bg-white',
  PARTIAL: 'bg-[#fff7e0] !border-[#f3dfa3]',
  FULL: 'bg-sc-paper-2',
  CLASS: 'bg-sc-primary-soft',
  MAINTENANCE: 'bg-[#fbe9e4]',
  CLOSED: 'bg-sc-paper opacity-70',
};

function tooltipOf(slot: FacilitySlot) {
  if (slot.status === 'CLASS') return `Lớp ${slot.classSession?.className ?? ''}`.trim();
  if (slot.status === 'MAINTENANCE') return `Bảo trì: ${slot.maintenance?.reason ?? ''}`;
  if (slot.status === 'CLOSED') return 'Ngoài giờ nhận đặt';
  if (slot.capacity > 1) return `${slot.startTime}–${slot.endTime} · ${slot.booked}/${slot.capacity} chỗ`;
  return `${slot.startTime}–${slot.endTime} · ${STATUS_LABEL[slot.status]}`;
}

interface SlotGridProps {
  facilities: Facility[];
  schedules: Record<string, FacilitySchedule | undefined>;
  loading?: boolean;
  selection: SlotSelection | null;
  onSelect: (selection: SlotSelection | null) => void;
  maxSlots?: number;
}

/** Facility × slot grid for one day (UC_2.10). Click a free slot, then neighbours to extend the range. */
export function SlotGrid({ facilities, schedules, loading, selection, onSelect, maxSlots = 3 }: SlotGridProps) {
  const reference = facilities.map((facility) => schedules[facility.id]).find(Boolean);
  const columns = reference?.slots ?? [];

  const currentSelection = isValidSelection(selection, schedules, maxSlots) ? selection : null;
  const click = (facilityId: string, index: number) => {
    onSelect(selectSlot(schedules, currentSelection, facilityId, index, maxSlots));
  };

  if (!columns.length) {
    return (
      <div className="rounded-lg border border-dashed border-sc-border px-4 py-10 text-center text-sc-muted">
        {loading ? 'Đang tải lịch…' : 'Chưa có lịch cho ngày này.'}
      </div>
    );
  }

  const template = `minmax(112px,190px) repeat(${columns.length}, minmax(52px, 1fr))`;

  return (
    <div className="overflow-x-auto">
      <div role="grid" aria-busy={loading} className="min-w-[720px]">
        <div role="row" className="grid gap-1" style={{ gridTemplateColumns: template }}>
          <div className="sticky left-0 z-[1] bg-white" />
          {columns.map((slot) => (
            <div
              key={slot.startTime}
              role="columnheader"
              className="pb-1 text-center text-[11.5px] font-semibold text-sc-muted tabular-nums"
            >
              {slot.startTime}
            </div>
          ))}
        </div>
        {facilities.map((facility) => {
          const schedule = schedules[facility.id];
          return (
            <div key={facility.id} role="row" className="mt-1 grid gap-1" style={{ gridTemplateColumns: template }}>
              <div className="sticky left-0 z-[1] flex min-w-0 flex-col justify-center bg-white pr-2">
                <b className="truncate text-[13.5px]">{facility.name}</b>
                <span className="truncate text-[11.5px] text-sc-muted">
                  {formatVND(facility.pricePerSlot)}/slot
                  {facility.capacityPerSlot > 1 ? ` · ${facility.capacityPerSlot} chỗ` : ''}
                </span>
              </div>
              {columns.map((column, index) => {
                const slot = schedule?.slots[index];
                if (!slot) {
                  return <div key={column.startTime} className="h-10 animate-pulse rounded-md bg-sc-paper-2" />;
                }
                const selected =
                  currentSelection?.facilityId === facility.id &&
                  index >= currentSelection.startIndex &&
                  index < currentSelection.startIndex + currentSelection.count;
                const selectable = isSelectableSlot(slot);
                const label =
                  selected && index === currentSelection.startIndex && currentSelection.count > 1
                    ? `${slot.startTime}`
                    : slot.status === 'CLASS'
                      ? 'Lớp'
                      : slot.status === 'MAINTENANCE'
                        ? 'BT'
                        : slot.capacity > 1 && slot.status !== 'CLOSED'
                          ? `${slot.booked}/${slot.capacity}`
                          : '';
                return (
                  <Tooltip key={slot.startTime} title={tooltipOf(slot)} mouseEnterDelay={0.3}>
                    <button
                      type="button"
                      role="gridcell"
                      disabled={loading || !selectable}
                      aria-pressed={selected}
                      aria-label={`${facility.name} ${slot.startTime} đến ${slot.endTime}: ${STATUS_LABEL[slot.status]}${selected ? ', đang chọn' : ''}`}
                      onClick={() => click(facility.id, index)}
                      className={`h-10 rounded-md border border-sc-border-soft text-[11.5px] font-semibold tabular-nums [transition:background_0.12s,border-color_0.12s] disabled:opacity-100 ${
                        selected ? '!border-sc-primary !bg-sc-primary !text-sc-lime' : CELL_STYLE[slot.status]
                      }`}
                    >
                      {label}
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          );
        })}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-sc-muted">
          {(['AVAILABLE', 'PARTIAL', 'FULL', 'CLASS', 'MAINTENANCE', 'CLOSED'] as SlotStatus[]).map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <i className={`inline-block size-3.5 rounded-sm border border-sc-border-soft ${LEGEND_STYLE[status]}`} />
              {STATUS_LABEL[status]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block size-3.5 rounded-sm bg-sc-primary" />
            Đang chọn
          </span>
          <span className="text-sc-muted-2">Bấm ô kề bên để kéo dài, tối đa {maxSlots} slot.</span>
        </div>
      </div>
    </div>
  );
}
