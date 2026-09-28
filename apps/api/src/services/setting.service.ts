import { ERROR_CODE, type UpdateSettingsBody } from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Prisma } from '~/generated/prisma/client';
import { toBookingConflict, toSessionConflict, toSettingResponse } from '~/mappers/setting.mapper';
import scheduleRepository from '~/repositories/schedule.repository';
import settingRepository from '~/repositories/setting.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import { fromDbTime, isOnSlotGrid, parseTime, toDbTime } from '~/utils/time';
import { lockRows, runTransaction, withScheduleLock } from '~/utils/transaction';

interface Grid {
  openTime: number;
  closeTime: number;
  slotMinutes: number;
}

const invalid = (field: keyof UpdateSettingsBody, message: string) =>
  new ErrorWithStatus({
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    code: ERROR_CODE.VALIDATION,
    message: 'Dữ liệu không hợp lệ',
    errors: [{ path: `body.${field}`, message }],
  });

const offGrid =
  ({ openTime, closeTime, slotMinutes }: Grid) =>
  (row: { startTime: Date; endTime: Date }) =>
    !isOnSlotGrid({ start: fromDbTime(row.startTime), end: fromDbTime(row.endTime) }, openTime, closeTime, slotMinutes);

class SettingService {
  get = async () => toSettingResponse(await settingRepository.get());

  update = async (managerId: string, body: UpdateSettingsBody, ip?: string) => {
    const setting = await runTransaction(async (tx) => {
      await withScheduleLock(tx);
      await lockRows(tx, { systemSettings: 'update' });
      const current = await settingRepository.get(tx);

      const before: Grid = {
        openTime: fromDbTime(current.openTime),
        closeTime: fromDbTime(current.closeTime),
        slotMinutes: current.slotDurationMinutes,
      };
      const after: Grid = {
        openTime: body.openTime ? parseTime(body.openTime) : before.openTime,
        closeTime: body.closeTime ? parseTime(body.closeTime) : before.closeTime,
        slotMinutes: body.slotDurationMinutes ?? before.slotMinutes,
      };

      if (after.openTime >= after.closeTime) {
        throw body.closeTime
          ? invalid('closeTime', 'Giờ đóng cửa phải sau giờ mở cửa')
          : invalid('openTime', 'Giờ mở cửa phải trước giờ đóng cửa');
      }
      if (after.closeTime - after.openTime < after.slotMinutes) {
        throw invalid('slotDurationMinutes', 'Thời lượng slot dài hơn thời gian hoạt động trong ngày');
      }

      const gridChanged =
        after.openTime !== before.openTime ||
        after.closeTime !== before.closeTime ||
        after.slotMinutes !== before.slotMinutes;
      if (gridChanged) {
        const bookings = (await scheduleRepository.findUpcomingBookings({}, tx)).filter(offGrid(after));
        const sessions = (await scheduleRepository.findUpcomingSessions({}, tx)).filter(offGrid(after));
        if (bookings.length > 0 || sessions.length > 0) {
          throw new ErrorWithStatus({
            status: HTTP_STATUS.CONFLICT,
            code: ERROR_CODE.SCHEDULE_CONFLICT,
            message: 'Còn booking hoặc buổi học sắp tới không khớp giờ hoạt động mới',
            meta: { bookings: bookings.map(toBookingConflict), sessions: sessions.map(toSessionConflict) },
          });
        }
      }

      const { openTime, closeTime, ...rest } = body;
      const data: Prisma.SystemSettingUpdateInput = {
        ...rest,
        ...(openTime && { openTime: toDbTime(after.openTime) }),
        ...(closeTime && { closeTime: toDbTime(after.closeTime) }),
        updatedBy: { connect: { id: managerId } },
      };
      const updated = await settingRepository.update(data, tx);
      await auditService.record(
        {
          accountId: managerId,
          action: 'UPDATE',
          entityType: 'SYSTEM_SETTING',
          entityId: '1',
          oldValues: current,
          newValues: updated,
          ipAddress: ip,
        },
        tx,
      );
      return updated;
    });
    return toSettingResponse(setting);
  };
}

export default new SettingService();
