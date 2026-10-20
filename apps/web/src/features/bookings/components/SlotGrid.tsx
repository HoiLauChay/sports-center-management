import type { Facility, FacilitySchedule, FacilitySlot, FacilitySlotStatus } from '@sports-center/shared';
import { Grid, Tooltip } from 'antd';
import { useState } from 'react';
import { formatVND } from '~/lib/format';
import { isPast } from '~/lib/time';
import type { SlotSelection } from '../types';
import { isSelectableSlot, isValidSelection, selectSlot } from '../utils/slot-selection';

type SlotTone = FacilitySlotStatus | 'PARTIAL' | 'LOW' | 'PAST';

const LOW_SHARE = 0.2;

const toneOf = (slot: FacilitySlot, date: string): SlotTone => {
  if (slot.status === 'CLOSED' && isPast(date, slot.startTime)) return 'PAST';
  if (slot.status !== 'AVAILABLE' || slot.booked === 0) return slot.status;
  return slot.capacity - slot.booked <= Math.max(1, Math.floor(slot.capacity * LOW_SHARE)) ? 'LOW' : 'PARTIAL';
};

const STATUS_LABEL: Record<SlotTone, string> = {
  AVAILABLE: 'Trống',
  PARTIAL: 'Còn chỗ',
  LOW: 'Sắp hết',
  FULL: 'Đã đầy',
  CLASS: 'Có lớp',
  MAINTENANCE: 'Bảo trì',
  CLOSED: 'Sân đóng',
  PAST: 'Đã qua',
};

const CELL_STYLE: Record<SlotTone, string> = {
  AVAILABLE:
    'bg-white text-emerald-800 border-slate-200/90 hover:border-emerald-500 hover:bg-emerald-50/50 hover:shadow-xs cursor-pointer',
  PARTIAL:
    'bg-white text-emerald-800 border-emerald-200 hover:border-emerald-500 hover:bg-emerald-50/50 hover:shadow-xs cursor-pointer',
  LOW: 'bg-amber-50/90 border-amber-200/90 text-amber-900 hover:bg-amber-100 hover:border-amber-300 cursor-pointer shadow-xs',
  FULL: 'bg-slate-100/90 border-slate-200 text-slate-400 cursor-not-allowed [background-image:repeating-linear-gradient(135deg,transparent_0_5px,rgba(0,0,0,.03)_5px_6px)]',
  CLASS: 'bg-emerald-50/90 border-emerald-200 text-emerald-800 cursor-not-allowed',
  MAINTENANCE: 'bg-rose-50/90 border-rose-200 text-rose-800 cursor-not-allowed',
  CLOSED: 'bg-slate-50/80 border-slate-100 text-slate-300 cursor-not-allowed',
  PAST: 'bg-slate-50/80 border-slate-100 text-slate-300 cursor-not-allowed',
};

const LEGEND_BADGE: Record<SlotTone, { bg: string; border: string }> = {
  AVAILABLE: { bg: 'bg-white', border: 'border-slate-300' },
  PARTIAL: { bg: 'bg-white', border: 'border-emerald-300' },
  LOW: { bg: 'bg-amber-100', border: 'border-amber-300' },
  FULL: { bg: 'bg-slate-200', border: 'border-slate-300' },
  CLASS: { bg: 'bg-emerald-100', border: 'border-emerald-300' },
  MAINTENANCE: { bg: 'bg-rose-100', border: 'border-rose-300' },
  CLOSED: { bg: 'bg-slate-100', border: 'border-slate-200' },
  PAST: { bg: 'bg-slate-50', border: 'border-slate-100' },
};

function tooltipOf(slot: FacilitySlot, date: string) {
  if (toneOf(slot, date) === 'PAST') return 'Khung giờ đã bắt đầu';
  if (slot.status === 'CLASS') return `Lớp ${slot.classSession?.className ?? ''}`.trim();
  if (slot.status === 'MAINTENANCE') return `Bảo trì: ${slot.maintenance?.reason ?? ''}`;
  if (slot.status === 'CLOSED') return 'Sân không mở cửa khung giờ này';
  if (slot.capacity > 1)
    return `${slot.startTime}–${slot.endTime} · Đã đặt ${slot.booked}/${slot.capacity}, còn ${Math.max(0, slot.capacity - slot.booked)} chỗ`;
  return `${slot.startTime}–${slot.endTime} · ${STATUS_LABEL[toneOf(slot, date)]}`;
}

interface SlotGridProps {
  facilities: Facility[];
  schedules: Record<string, FacilitySchedule | undefined>;
  loading?: boolean;
  selection?: SlotSelection | null;
  onSelect?: (selection: SlotSelection | null) => void;
  maxSlots?: number;
  /** `table` still turns into cards on phones, where a wide grid would need sideways scrolling. */
  layout?: 'table' | 'cards';
}

/** Facility × slot grid for one day (UC_2.10). Click a free slot, then neighbours to extend the range. */
export function SlotGrid({
  facilities,
  schedules,
  loading,
  selection = null,
  onSelect,
  maxSlots = 3,
  layout = 'table',
}: SlotGridProps) {
  const isMobile = Grid.useBreakpoint().md === false;
  const reference = facilities.map((facility) => schedules[facility.id]).find(Boolean);
  const columns = reference?.slots ?? [];
  const date = reference?.date ?? '';

  const [showPast, setShowPast] = useState(false);
  const pastCount = (facilityId: string) =>
    (schedules[facilityId]?.slots ?? []).filter((slot) => toneOf(slot, date) === 'PAST').length;

  const currentSelection = isValidSelection(selection, schedules, maxSlots) ? selection : null;
  const click = (facilityId: string, index: number) => {
    onSelect?.(selectSlot(schedules, currentSelection, facilityId, index, maxSlots));
  };

  if (!columns.length) {
    return (
      <div className="rounded-lg border border-dashed border-sc-border px-4 py-10 text-center text-sc-muted">
        {loading ? 'Đang tải lịch…' : 'Chưa có lịch cho ngày này.'}
      </div>
    );
  }

  if (layout === 'cards' || isMobile) {
    return (
      <div className="flex flex-col gap-4" aria-busy={loading}>
        {facilities.map((facility) => (
          <section key={facility.id} aria-label={`Khung giờ ${facility.name}`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-base font-semibold">{facility.name}</span>
              <span className="text-[15px] text-sc-muted">
                {formatVND(facility.pricePerSlot)}/slot · {facility.capacityPerSlot} chỗ
              </span>
            </div>
            {pastCount(facility.id) > 0 && (
              <button
                type="button"
                onClick={() => setShowPast((value) => !value)}
                className="mb-2 cursor-pointer border-0 bg-transparent p-0 [font:inherit] text-[14.5px] font-semibold text-sc-primary"
              >
                {showPast ? 'Ẩn các khung giờ đã qua' : `Hiện ${pastCount(facility.id)} khung giờ đã qua`}
              </button>
            )}
            {!showPast && pastCount(facility.id) === (schedules[facility.id]?.slots.length ?? 0) && (
              <p className="mt-0 mb-2 rounded-lg bg-sc-paper px-3 py-4 text-center text-sc-muted">
                Hôm nay đã hết khung giờ đặt. Chọn ngày khác ở trên.
              </p>
            )}
            {/* Columns follow the space the grid gets (the counter puts it in a narrow column), not the viewport. */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2 md:gap-3">
              {(schedules[facility.id]?.slots ?? []).map((slot, index) => {
                if (!showPast && toneOf(slot, date) === 'PAST') return null;
                const selected =
                  currentSelection?.facilityId === facility.id &&
                  index >= currentSelection.startIndex &&
                  index < currentSelection.startIndex + currentSelection.count;
                const available = isSelectableSlot(slot);
                return (
                  <Tooltip key={slot.startTime} title={tooltipOf(slot, date)}>
                    <button
                      type="button"
                      disabled={loading || !onSelect || !available}
                      aria-pressed={selected}
                      aria-label={`${facility.name} ${slot.startTime} đến ${slot.endTime}: ${STATUS_LABEL[toneOf(slot, date)]}${selected ? ', đang chọn' : ''}`}
                      onClick={() => click(facility.id, index)}
                      className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl border border-sc-border-soft px-2 py-2.5 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sc-primary md:min-h-20 ${selected ? '!border-sc-primary !bg-sc-primary !text-white' : CELL_STYLE[toneOf(slot, date)]}`}
                    >
                      <span className="block text-[14px] font-bold tabular-nums">
                        {slot.startTime}–{slot.endTime}
                      </span>
                      <span className="flex flex-col items-center gap-0.5 text-[13px]">
                        <span>{selected ? '✓ Đang chọn' : STATUS_LABEL[toneOf(slot, date)]}</span>
                        {available && (
                          <span className="whitespace-nowrap">
                            Còn {Math.max(0, slot.capacity - slot.booked)}/{slot.capacity} chỗ
                          </span>
                        )}
                      </span>
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </section>
        ))}
        <p className="m-0 text-[14.5px] text-sc-muted" role="status">
          Chọn tối đa {maxSlots} slot liên tiếp. Bấm slot ở đầu hoặc cuối để bỏ bớt.
        </p>
      </div>
    );
  }

  const template = `minmax(200px, 250px) repeat(${columns.length}, minmax(72px, 1fr))`;

  return (
    <div>
      <div
        className="overflow-x-auto pb-2"
        tabIndex={0}
        role="region"
        aria-label="Lịch slot, cuộn ngang để xem các giờ"
      >
        <div role="grid" aria-label="Lịch sân theo khung giờ" aria-busy={loading} className="min-w-[760px]">
          {/* Header Row */}
          <div role="row" className="grid gap-1.5" style={{ gridTemplateColumns: template }}>
            <div className="sticky left-0 z-10 flex items-end bg-white pb-1 pl-1 pr-3 border-r border-slate-200/90 shadow-[3px_0_8px_-3px_rgba(0,0,0,0.05)]">
              <span className="text-[14.5px] font-bold uppercase tracking-wider text-slate-400">Sân / Phòng</span>
            </div>
            {columns.map((slot) => (
              <div
                key={slot.startTime}
                role="columnheader"
                className="flex items-center justify-center py-1.5 px-1 rounded-md bg-slate-100/80 text-center font-mono text-[13px] font-semibold text-sc-ink tabular-nums"
              >
                {slot.startTime}
              </div>
            ))}
          </div>

          {/* Facility Rows */}
          {facilities.map((facility) => {
            const schedule = schedules[facility.id];
            return (
              <div
                key={facility.id}
                role="row"
                className="mt-1.5 grid gap-1.5"
                style={{ gridTemplateColumns: template }}
              >
                {/* Sticky Facility Column */}
                <div className="sticky left-0 z-10 flex min-w-0 flex-col justify-center bg-white py-1 pl-1 pr-3 border-r border-slate-200/90 shadow-[3px_0_8px_-3px_rgba(0,0,0,0.05)]">
                  <span className="font-semibold text-sc-ink text-[15px] truncate" title={facility.name}>
                    {facility.name}
                  </span>
                  <span className="text-[14.5px] text-sc-muted truncate">
                    {formatVND(facility.pricePerSlot)}/slot
                    {facility.capacityPerSlot > 1 ? ` · ${facility.capacityPerSlot} chỗ` : ''}
                  </span>
                </div>

                {/* Time Slots */}
                {columns.map((column, index) => {
                  const slot = schedule?.slots[index];
                  if (!slot) {
                    return <div key={column.startTime} className="h-11 animate-pulse rounded-lg bg-slate-100" />;
                  }
                  const selected =
                    currentSelection?.facilityId === facility.id &&
                    index >= currentSelection.startIndex &&
                    index < currentSelection.startIndex + currentSelection.count;
                  const selectable = isSelectableSlot(slot);
                  const tone = toneOf(slot, date);

                  return (
                    <Tooltip key={slot.startTime} title={tooltipOf(slot, date)} mouseEnterDelay={0.25}>
                      <button
                        type="button"
                        role="gridcell"
                        disabled={loading || !onSelect || !selectable}
                        aria-pressed={selected}
                        aria-label={`${facility.name} ${slot.startTime} đến ${slot.endTime}: ${STATUS_LABEL[tone]}${selected ? ', đang chọn' : ''}`}
                        onClick={() => click(facility.id, index)}
                        className={`group/cell relative flex flex-col items-center justify-center h-12 rounded-lg border text-[13.5px] tabular-nums transition-all disabled:opacity-100 ${
                          selected
                            ? '!border-sc-primary !bg-sc-primary !text-white shadow-sm font-semibold'
                            : CELL_STYLE[tone]
                        }`}
                      >
                        {selected ? (
                          <span className="font-bold text-[13.5px] text-white">✓ Chọn</span>
                        ) : slot.status === 'CLASS' ? (
                          <span className="font-semibold text-[13.5px] text-emerald-800">Có lớp</span>
                        ) : slot.status === 'MAINTENANCE' ? (
                          <span className="font-semibold text-[13.5px] text-rose-700">Bảo trì</span>
                        ) : slot.status === 'CLOSED' ? (
                          <span className="text-[13.5px] text-slate-300">{STATUS_LABEL[tone]}</span>
                        ) : slot.status === 'FULL' ? (
                          <span className="font-medium text-[13.5px] text-slate-400">Hết chỗ</span>
                        ) : tone === 'PARTIAL' || tone === 'LOW' ? (
                          <div className="flex flex-col items-center justify-center leading-none">
                            <span
                              className={`font-bold text-[14.5px] ${tone === 'LOW' ? 'text-amber-900' : 'text-emerald-800'}`}
                            >
                              {slot.booked}/{slot.capacity}
                            </span>
                            <span
                              className={`text-[12.5px] mt-0.5 ${tone === 'LOW' ? 'text-amber-700' : 'text-emerald-700'}`}
                            >
                              còn {slot.capacity - slot.booked}
                            </span>
                          </div>
                        ) : slot.capacity > 1 ? (
                          <div className="flex flex-col items-center justify-center leading-none">
                            <span className="font-medium text-[14.5px] text-emerald-700">0/{slot.capacity}</span>
                            <span className="text-[12.5px] text-emerald-700 mt-0.5">Trống</span>
                          </div>
                        ) : (
                          <span className="font-medium text-[13.5px] text-emerald-700 group-hover/cell:scale-105 transition-transform">
                            Trống
                          </span>
                        )}
                      </button>
                    </Tooltip>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3.5 text-[14.5px] text-sc-muted">
        <span className="font-semibold text-sc-ink-2">Chú thích:</span>
        {(['AVAILABLE', 'PARTIAL', 'LOW', 'FULL', 'CLASS', 'MAINTENANCE', 'CLOSED', 'PAST'] as SlotTone[]).map(
          (status) => (
            <span key={status} className="inline-flex items-center gap-1.5 font-medium text-sc-ink-2">
              <span
                className={`inline-block size-3 rounded border ${LEGEND_BADGE[status].bg} ${LEGEND_BADGE[status].border}`}
              />
              {STATUS_LABEL[status]}
            </span>
          ),
        )}
        {onSelect && (
          <>
            <span className="inline-flex items-center gap-1.5 font-medium text-sc-ink-2">
              <span className="inline-block size-3 rounded bg-sc-primary" />
              Đang chọn
            </span>
            <span className="text-sc-muted-2">Bấm ô kề bên để kéo dài, tối đa {maxSlots} slot.</span>
          </>
        )}
      </div>
    </div>
  );
}
