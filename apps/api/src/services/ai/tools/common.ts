import { z } from 'zod';

import { POLICIES, POLICY_TOPICS } from '~/services/ai/policies';
import { findSportId, isoDate, noArgs, tool, unknownSport, weekdayOf, type Tool } from '~/services/ai/tools/toolkit';
import classService from '~/services/class.service';
import facilityService from '~/services/facility.service';
import membershipService from '~/services/membership.service';
import settingService from '~/services/setting.service';
import sportService from '~/services/sport.service';
import { addDays, todayInCenter } from '~/utils/time';

const MAX_SLOTS_PER_FACILITY = 8;

const optionalSport = z.object({ sport: z.string().trim().max(100).optional() });
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ phải có dạng HH:mm');

const outsideBookingWindow = async (date: string) => {
  const today = todayInCenter();
  const { maxAdvanceBookingDays } = await settingService.get();
  return date < today || date > addDays(today, maxAdvanceBookingDays)
    ? { error: `Chỉ xem được từ hôm nay đến ${maxAdvanceBookingDays} ngày tới` }
    : null;
};

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
      if (sportId === null) return { facilities: [], ...(await unknownSport(sport)) };
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
      const outside = await outsideBookingWindow(date);
      if (outside) return outside;
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
      name: 'find_available_slots',
      description:
        'Tìm slot còn trống của mọi sân/phòng thuộc một bộ môn trong một ngày, lọc theo khung giờ nếu có. Dùng khi người hỏi chưa chọn sân cụ thể, ví dụ "tối mai sân cầu lông nào trống".',
      parameters: {
        type: 'OBJECT',
        properties: {
          sport: { type: 'STRING', description: 'Tên bộ môn, ví dụ "Cầu lông"' },
          date: { type: 'STRING', format: 'date', description: 'Ngày, dạng YYYY-MM-DD' },
          from: { type: 'STRING', description: 'Từ giờ, HH:mm, không bắt buộc' },
          to: { type: 'STRING', description: 'Đến giờ, HH:mm, không bắt buộc' },
        },
        required: ['sport', 'date'],
      },
    },
    z.object({
      sport: z.string().trim().min(1).max(100),
      date: isoDate,
      from: time.optional(),
      to: time.optional(),
    }),
    async (_context, { sport, date, from = '00:00', to = '23:59' }) => {
      const outside = await outsideBookingWindow(date);
      if (outside) return outside;
      const sportId = await findSportId(sport);
      if (sportId === null) return { facilities: [], ...(await unknownSport(sport)) };
      const facilities = await facilityService.list({ sportId }, false);
      const days = await Promise.all(facilities.map(({ id }) => facilityService.schedule(id, date)));
      const found = facilities.flatMap((facility, index) => {
        const slots = days[index]!.slots.filter(
          ({ status, startTime, endTime }) => status === 'AVAILABLE' && startTime >= from && endTime <= to,
        );
        return slots.length
          ? [
              {
                facilityId: facility.id,
                facility: facility.name,
                pricePerSlotVnd: facility.pricePerSlot,
                slotsFound: slots.length,
                slots: slots
                  .slice(0, MAX_SLOTS_PER_FACILITY)
                  .map(({ startTime, endTime, booked, capacity }) => ({ startTime, endTime, left: capacity - booked })),
              },
            ]
          : [];
      });
      return { date, weekday: weekdayOf(date), facilities: found };
    },
  ),
  tool(
    {
      name: 'get_policies',
      description:
        'Quy định của trung tâm theo chủ đề: BOOKING (đặt sân, hủy sân), CLASS (đăng ký, hủy lớp), MEMBERSHIP (gói, gia hạn, đổi gói), WALLET (ví, nạp tiền), REFUND (hoàn tiền), COUPON, CHECKIN (check-in, điểm danh), SUPPORT (yêu cầu hỗ trợ).',
      parameters: {
        type: 'OBJECT',
        properties: { topic: { type: 'STRING', enum: [...POLICY_TOPICS], description: 'Chủ đề' } },
        required: ['topic'],
      },
    },
    z.object({ topic: z.enum(POLICY_TOPICS, 'Chủ đề không hợp lệ') }),
    async (_context, { topic }) => ({ topic, rules: POLICIES[topic] }),
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
      if (sportId === null) return { classes: [], ...(await unknownSport(sport)) };
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
        total: page.total,
        weekdayMeaning: 'dayOfWeek: 0 Chủ nhật, 1 Thứ 2, ... 6 Thứ 7',
      };
    },
  ),
];
