import { SUPPORT_STATUSES } from '@sports-center/shared';
import { z } from 'zod';

import { classIdArg, isoDate, tool, weekdayOf, type Tool, type ToolParameters } from '~/services/ai/tools/toolkit';
import bookingService from '~/services/booking.service';
import checkinService from '~/services/checkin.service';
import classService from '~/services/class.service';
import enrollmentService from '~/services/enrollment.service';
import memberMembershipService from '~/services/memberMembership.service';
import sessionService from '~/services/session.service';
import supportService from '~/services/support.service';
import userService from '~/services/user.service';
import walletService from '~/services/wallet.service';
import { todayInCenter } from '~/utils/time';

const MAX_MEMBERS = 5;
const dateArg = z.object({ date: isoDate.optional() });
const dateParam: ToolParameters = {
  type: 'OBJECT',
  properties: { date: { type: 'STRING', format: 'date', description: 'Ngày, YYYY-MM-DD; bỏ trống là hôm nay' } },
  required: [],
};

const receptionistOf = (accountId: string) => ({ id: accountId, role: 'RECEPTIONIST' as const });

/**
 * Counter work: members, bookings, sessions, check-ins and support requests, exactly as the reception pages show
 * them. Personal details stay out unless the counter needs them (no address, birth date or health notes).
 */
export const RECEPTION_TOOLS: Tool[] = [
  tool(
    {
      name: 'find_members',
      description: `Tìm hội viên theo tên, số điện thoại hoặc email (tối đa ${MAX_MEMBERS} kết quả): mã hội viên, tên, SĐT, trạng thái tài khoản.`,
      parameters: {
        type: 'OBJECT',
        properties: { query: { type: 'STRING', description: 'Tên, SĐT hoặc email cần tìm' } },
        required: ['query'],
      },
    },
    z.object({ query: z.string().trim().min(2, 'Từ khóa tối thiểu 2 ký tự').max(100) }),
    async ({ accountId }, { query }) => {
      const page = await userService.list(receptionistOf(accountId), {
        page: 1,
        limit: MAX_MEMBERS,
        q: query,
        role: 'MEMBER',
      });
      return {
        total: page.total,
        members: page.items.map((member) => ({
          memberId: member.id,
          name: member.fullName,
          phone: member.phone,
          status: 'status' in member ? member.status : null,
        })),
      };
    },
  ),
  tool(
    {
      name: 'member_overview',
      description:
        'Tình trạng một hội viên tại quầy: số dư ví, gói thành viên hiện tại và hạn, lớp đang học, sân đã đặt sắp tới. Cần mã hội viên từ find_members.',
      parameters: {
        type: 'OBJECT',
        properties: { memberId: { type: 'STRING', description: 'Mã hội viên (memberId từ find_members)' } },
        required: ['memberId'],
      },
    },
    z.object({ memberId: z.uuid('Mã hội viên không hợp lệ') }),
    async ({ accountId }, { memberId }) => {
      // Same visibility as the members page: only member accounts, 404 for anyone else.
      const member = await userService.getById(receptionistOf(accountId), memberId);
      const today = todayInCenter();
      const [wallet, memberships, enrollments, bookings] = await Promise.all([
        walletService.getForMember(memberId, { page: 1, limit: 3 }),
        memberMembershipService.list(memberId),
        enrollmentService.listMine(memberId),
        bookingService.listMine(memberId, { page: 1, limit: 5, from: today }),
      ]);
      const current = memberships.current;
      return {
        name: member.fullName,
        phone: member.phone,
        status: 'status' in member ? member.status : null,
        walletBalanceVnd: wallet.balance,
        membership: current
          ? {
              name: current.package.name,
              status: current.status,
              endDate: current.endDate,
              autoRenew: current.autoRenew,
            }
          : null,
        classes: enrollments
          .filter(({ status }) => status === 'ENROLLED')
          .map(({ class: cls, sessionsLeft }) => ({ name: cls.name, sessionsLeft })),
        upcomingBookings: bookings.items.map((booking) => ({
          facility: booking.facility.name,
          date: booking.date,
          weekday: weekdayOf(booking.date),
          time: `${booking.startTime}–${booking.endTime}`,
          status: booking.status,
        })),
        today,
      };
    },
  ),
  tool(
    {
      name: 'bookings_on',
      description:
        'Các lượt đặt sân trong một ngày (mặc định hôm nay), lọc theo sân nếu có: sân, giờ, trạng thái, người đặt (hội viên hoặc khách).',
      parameters: {
        type: 'OBJECT',
        properties: {
          date: { type: 'STRING', format: 'date', description: 'Ngày, YYYY-MM-DD; bỏ trống là hôm nay' },
          facilityId: { type: 'STRING', description: 'Mã sân (từ list_facilities), không bắt buộc' },
        },
        required: [],
      },
    },
    dateArg.extend({ facilityId: z.uuid('Mã sân không hợp lệ').optional() }),
    async (_context, { date = todayInCenter(), facilityId }) => {
      const page = await bookingService.list({ page: 1, limit: 100, from: date, to: date, facilityId });
      return {
        date,
        weekday: weekdayOf(date),
        total: page.total,
        bookings: page.items.map((booking) => ({
          facility: booking.facility.name,
          time: `${booking.startTime}–${booking.endTime}`,
          status: booking.status,
          bookedBy: booking.account?.fullName ?? (booking.guestName ? `Khách: ${booking.guestName}` : null),
        })),
      };
    },
  ),
  tool(
    {
      name: 'sessions_on',
      description: 'Các buổi học trong một ngày (mặc định hôm nay): giờ, lớp, bộ môn, phòng, HLV, sĩ số.',
      parameters: dateParam,
    },
    dateArg,
    async (_context, { date = todayInCenter() }) => ({
      date,
      weekday: weekdayOf(date),
      sessions: (await sessionService.listOn({ date })).map((session) => ({
        time: `${session.startTime}–${session.endTime}`,
        className: session.class.name,
        sport: session.class.sport.name,
        place: session.facility.name,
        coach: session.coach?.fullName ?? null,
        status: session.status,
        enrolled: `${session.class.enrolledCount}/${session.class.maxStudents}`,
      })),
    }),
  ),
  tool(
    {
      name: 'checkins_on',
      description: 'Lượt check-in vào trung tâm trong một ngày (mặc định hôm nay): tổng số và 10 lượt gần nhất.',
      parameters: dateParam,
    },
    dateArg,
    async (_context, { date = todayInCenter() }) => {
      const checkins = await checkinService.list({ date });
      return {
        date,
        total: checkins.length,
        latest: checkins
          .slice(0, 10)
          .map(({ account, checkedInAt }) => ({ member: account.fullName, at: checkedInAt })),
      };
    },
  ),
  tool(
    {
      name: 'find_classes',
      description: 'Tìm lớp học theo tên hoặc tên HLV: mã lớp, tên, bộ môn, trạng thái, lịch tuần, sĩ số.',
      parameters: {
        type: 'OBJECT',
        properties: { query: { type: 'STRING', description: 'Tên lớp hoặc HLV; bỏ trống để xem các lớp gần đây' } },
        required: [],
      },
    },
    z.object({ query: z.string().trim().min(1).max(100).optional() }),
    async ({ accountId }, { query }) => {
      const page = await classService.list({ id: accountId, role: 'RECEPTIONIST' }, { page: 1, limit: 10, q: query });
      return {
        classes: page.items.map((cls) => ({
          classId: cls.id,
          name: cls.name,
          sport: cls.course.sport.name,
          status: cls.status === 'CANCELLED' ? 'Đã hủy' : (cls.derivedStatus ?? cls.status),
          weeklySchedule: cls.weeklySchedule,
          coach: cls.coach?.fullName ?? null,
          enrolled: `${cls.enrolledCount}/${cls.maxStudents}`,
        })),
        weekdayMeaning: 'dayOfWeek: 0 Chủ nhật, 1 Thứ 2, ... 6 Thứ 7',
      };
    },
  ),
  tool(
    {
      name: 'class_enrollments',
      description:
        'Danh sách ghi danh của một lớp: tên hội viên, trạng thái, ngày ghi danh. Cần mã lớp từ find_classes.',
      parameters: {
        type: 'OBJECT',
        properties: { classId: { type: 'STRING', description: 'Mã lớp (từ find_classes)' } },
        required: ['classId'],
      },
    },
    classIdArg,
    async ({ accountId }, { classId }) => ({
      enrollments: (await enrollmentService.listForClass(receptionistOf(accountId), classId)).map((row) => ({
        member: row.account.fullName,
        status: row.status,
        enrolledAt: row.enrolledAt,
      })),
    }),
  ),
  tool(
    {
      name: 'support_queue',
      description:
        'Yêu cầu hỗ trợ của hội viên đang chờ: số lượng theo trạng thái và 10 yêu cầu mới nhất chưa xử lý xong.',
    },
    z.object({}),
    async () => {
      const [open, inProgress] = await Promise.all(
        (['OPEN', 'IN_PROGRESS'] as const).map((status) => supportService.list({ page: 1, limit: 10, status })),
      );
      return {
        counts: { open: open!.total, inProgress: inProgress!.total },
        latest: [...open!.items, ...inProgress!.items].slice(0, 10).map((request) => ({
          subject: request.subject,
          category: request.category,
          status: request.status,
          member: request.account.fullName,
          createdAt: request.createdAt,
        })),
        statuses: SUPPORT_STATUSES,
      };
    },
  ),
];
