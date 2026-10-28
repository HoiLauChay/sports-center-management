import { z } from 'zod';

import { findSportId, isoDate, noArgs, tool, weekdayOf, type Tool } from '~/services/ai/tools/toolkit';
import classService from '~/services/class.service';
import facilityService from '~/services/facility.service';
import membershipService from '~/services/membership.service';
import settingService from '~/services/setting.service';
import sportService from '~/services/sport.service';
import { addDays, todayInCenter } from '~/utils/time';

const optionalSport = z.object({ sport: z.string().trim().max(100).optional() });

/** Public information about the center, the same for every role. */
export const COMMON_TOOLS: Tool[] = [
  tool(
    {
      name: 'get_center_info',
      description:
        'Thông tin chung của trung tâm: giờ mở/đóng cửa, thời lượng một slot, đặt sân trước tối đa bao nhiêu ngày, số tiền nạp ví tối thiểu, các bộ môn.',
    },
    noArgs,
    async () => {
      const [settings, sports] = await Promise.all([settingService.get(), sportService.list(false)]);
      return {
        openTime: settings.openTime,
        closeTime: settings.closeTime,
        slotMinutes: settings.slotDurationMinutes,
        maxAdvanceBookingDays: settings.maxAdvanceBookingDays,
        topUpMinVnd: settings.topUpMinAmount,
        sports: sports.map(({ name }) => name),
      };
    },
  ),
  tool(
    {
      name: 'list_facilities',
      description:
        'Danh sách sân/phòng đang hoạt động: mã, tên, sức chứa mỗi slot, giá mỗi slot, bộ môn. Lọc theo bộ môn nếu có.',
      parameters: {
        type: 'OBJECT',
        properties: { sport: { type: 'STRING', description: 'Tên bộ môn, ví dụ "Cầu lông"' } },
        required: [],
      },
    },
    optionalSport,
    async (_context, { sport }) => {
      const sportId = await findSportId(sport);
      if (sportId === null) return { facilities: [], note: `Trung tâm không có bộ môn "${sport}"` };
      const facilities = await facilityService.list({ sportId }, false);
      return {
        facilities: facilities.map((facility) => ({
          id: facility.id,
          name: facility.name,
          capacityPerSlot: facility.capacityPerSlot,
          pricePerSlotVnd: facility.pricePerSlot,
          sports: facility.sports.map(({ name }) => name),
        })),
      };
    },
  ),
  tool(
    {
      name: 'check_availability',
      description:
        'Các slot trong một ngày của một sân/phòng và slot nào còn trống. Cần mã sân lấy từ list_facilities.',
      parameters: {
        type: 'OBJECT',
        properties: {
          facilityId: { type: 'STRING', description: 'Mã sân/phòng (id từ list_facilities)' },
          date: { type: 'STRING', format: 'date', description: 'Ngày, dạng YYYY-MM-DD' },
        },
        required: ['facilityId', 'date'],
      },
    },
    z.object({ facilityId: z.uuid('Mã sân không hợp lệ'), date: isoDate }),
    async (_context, { facilityId, date }) => {
      const today = todayInCenter();
      const { maxAdvanceBookingDays } = await settingService.get();
      if (date < today || date > addDays(today, maxAdvanceBookingDays)) {
        return { error: `Chỉ xem được từ hôm nay đến ${maxAdvanceBookingDays} ngày tới` };
      }
      const day = await facilityService.schedule(facilityId, date);
      return {
        facility: day.facility.name,
        date: day.date,
        weekday: weekdayOf(day.date),
        slots: day.slots.map(({ startTime, endTime, status, booked, capacity }) => ({
          time: `${startTime}–${endTime}`,
          status,
          booked,
          capacity,
        })),
        statusMeaning: 'AVAILABLE còn chỗ · FULL hết chỗ · CLASS có lớp học · MAINTENANCE bảo trì · CLOSED đã qua/đóng',
      };
    },
  ),
  tool(
    {
      name: 'list_memberships',
      description:
        'Các gói thành viên đang bán: mã gói, giá, thời hạn, quyền lợi (gym, giảm giá đặt sân/lớp, slot miễn phí và lượt hỏi trợ lý AI mỗi tháng).',
    },
    noArgs,
    async () => ({
      packages: (await membershipService.list(false)).map((pkg) => ({
        packageId: pkg.id,
        name: pkg.name,
        description: pkg.description,
        priceVnd: pkg.price,
        durationDays: pkg.durationDays,
        gymAccess: pkg.gymAccess,
        bookingDiscountPct: pkg.bookingDiscountPct,
        classDiscountPct: pkg.classDiscountPct,
        freeBookingSlotsPerMonth: pkg.freeBookingSlotsPerMonth,
        aiQuestionsPerMonth: pkg.aiQuestionsPerMonth,
      })),
    }),
  ),
  tool(
    {
      name: 'list_open_classes',
      description:
        'Các lớp đang mở đăng ký: mã lớp, tên lớp, khóa, bộ môn, lịch tuần, ngày bắt đầu, học phí, số chỗ còn. Lọc theo bộ môn nếu có.',
      parameters: {
        type: 'OBJECT',
        properties: { sport: { type: 'STRING', description: 'Tên bộ môn, ví dụ "Yoga"' } },
        required: [],
      },
    },
    optionalSport,
    async ({ accountId, role }, { sport }) => {
      const sportId = await findSportId(sport);
      if (sportId === null) return { classes: [], note: `Trung tâm không có bộ môn "${sport}"` };
      const page = await classService.list(
        { id: accountId, role },
        { page: 1, limit: 20, openForEnrollment: true, sportId },
      );
      return {
        classes: page.items.map((cls) => ({
          classId: cls.id,
          name: cls.name,
          course: cls.course.name,
          sport: cls.course.sport.name,
          weeklySchedule: cls.weeklySchedule,
          startDate: cls.startDate,
          startWeekday: cls.startDate ? weekdayOf(cls.startDate) : null,
          totalSessions: cls.course.totalSessions,
          priceVnd: cls.course.price,
          coach: cls.coach?.fullName ?? null,
          seatsLeft: cls.maxStudents - cls.enrolledCount,
        })),
        weekdayMeaning: 'dayOfWeek: 0 Chủ nhật, 1 Thứ 2, ... 6 Thứ 7',
      };
    },
  ),
];
