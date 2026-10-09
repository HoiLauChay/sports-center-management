import type reportRepository from '~/repositories/report.repository';
import type { SettingRow } from '~/repositories/setting.repository';
import {
  addDays,
  formatDate,
  fromDbTime,
  generateSlots,
  overlaps,
  toCenterDateTime,
  todayInCenter,
} from '~/utils/time';

type FacilityUsage = Awaited<ReturnType<typeof reportRepository.facilityUsage>>[number];

// A booking consumes one capacity unit; a class reserves the entire facility slot.
export const facilityOccupancy = (facility: FacilityUsage, from: string, to: string, settings: SettingRow) => {
  const grid = generateSlots(
    fromDbTime(settings.openTime),
    fromDbTime(settings.closeTime),
    settings.slotDurationMinutes,
  );
  let available = 0;
  let occupied = 0;
  for (let date = from; date <= to; date = addDays(date, 1)) {
    if (date < todayInCenter(facility.createdAt) || (facility.deletedAt && date > todayInCenter(facility.deletedAt)))
      continue;
    const bookings = facility.bookings.filter((row) => formatDate(row.bookingDate) === date);
    const sessions = facility.sessions.filter((row) => formatDate(row.sessionDate) === date);
    for (const slot of grid) {
      const startAt = toCenterDateTime(date, slot.start);
      const endAt = toCenterDateTime(date, slot.end);
      if (facility.maintenances.some((row) => row.startAt < endAt && startAt < row.endAt)) continue;
      available += facility.capacityPerSlot;
      const hits = (row: { startTime: Date; endTime: Date }) =>
        overlaps(slot, { start: fromDbTime(row.startTime), end: fromDbTime(row.endTime) });
      occupied += sessions.some(hits)
        ? facility.capacityPerSlot
        : Math.min(bookings.filter(hits).length, facility.capacityPerSlot);
    }
  }
  return { available, occupied };
};

export const percentage = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 10_000) / 100 : 0);
