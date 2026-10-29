import { checkoutItemInputSchema, createSupportBodySchema, SUPPORT_CATEGORIES } from '@sports-center/shared';
import { z } from 'zod';

import assistantRepository from '~/repositories/assistant.repository';
import { compareMemberships } from '~/services/ai/tools/consulting';
import {
  badRange,
  dateRange,
  dateRangeArgs,
  dateRangeParams,
  MAX_SCHEDULE_DAYS,
  noArgs,
  prepared,
  tool,
  weekdayOf,
  type Tool,
} from '~/services/ai/tools/toolkit';
import bookingService from '~/services/booking.service';
import checkoutService from '~/services/checkout/checkout.service';
import classTrainingService from '~/services/classTraining.service';
import enrollmentService from '~/services/enrollment.service';
import memberMembershipService from '~/services/memberMembership.service';
import personalScheduleService from '~/services/personalSchedule.service';
import walletService from '~/services/wallet.service';
import { formatDate, todayInCenter } from '~/utils/time';

const RECENT_RESULTS = 10;
const optionalClass = z.object({ classId: z.uuid('Mã lớp không hợp lệ').optional() });

const enrolledClassIds = async (accountId: string, classId?: string) =>
  (await assistantRepository.findEnrolledClasses(accountId, classId)).map(({ class: cls }) => cls);

/** The member's own schedule, training, account; every query uses the signed-in member. */
export const MEMBER_TOOLS: Tool[] = [
  tool(
    {
      name: 'my_schedule',
      description: `Lịch của người hỏi: buổi học và sân đã đặt trong khoảng ngày (tối đa ${MAX_SCHEDULE_DAYS} ngày). Mặc định từ hôm nay đến 7 ngày tới.`,
      parameters: dateRangeParams,
    },
    dateRangeArgs,
    async ({ accountId }, args) => {
      const range = dateRange(args);
      if (!range) return badRange;
      const { from, to } = range;
      const items = await personalScheduleService.member(accountId, { from, to });
      return {
        from,
        to,
        items: items.map((item) => ({
          kind: item.kind === 'CLASS_SESSION' ? 'Buổi học' : 'Đặt sân',
          title: item.kind === 'CLASS_SESSION' ? item.class.name : item.facility.name,
          date: item.date,
          weekday: weekdayOf(item.date),
          time: `${item.startTime}–${item.endTime}`,
          place: item.facility.name,
          coach: item.kind === 'CLASS_SESSION' ? (item.class.coach?.fullName ?? null) : null,
          status: item.status,
        })),
      };
    },
  ),
  tool(
    {
      name: 'my_enrollments',
      description: 'Các lớp người hỏi đã đăng ký: mã lớp, tên lớp, lịch tuần, HLV, số buổi còn lại, trạng thái.',
    },
    noArgs,
    async ({ accountId }) => ({
      enrollments: (await enrollmentService.listMine(accountId)).map((enrollment) => ({
        classId: enrollment.class.id,
        className: enrollment.class.name,
        sport: enrollment.class.course.sport.name,
        status: enrollment.status,
        weeklySchedule: enrollment.class.weeklySchedule,
        coach: enrollment.class.coach?.fullName ?? null,
        startDate: enrollment.class.startDate,
        endDate: enrollment.class.endDate,
        sessionsLeft: enrollment.sessionsLeft,
      })),
    }),
  ),
  tool(
    {
      name: 'my_training',
      description:
        'Kế hoạch tập luyện (kế hoạch chung của lớp và kế hoạch riêng HLV soạn cho người hỏi) cùng đánh giá giữa/cuối khóa của HLV. Bỏ trống classId để lấy mọi lớp đang học.',
      parameters: {
        type: 'OBJECT',
        properties: { classId: { type: 'STRING', description: 'Mã lớp (từ my_enrollments)' } },
        required: [],
      },
    },
    optionalClass,
    async ({ accountId }, { classId }) => {
      const classes = await enrolledClassIds(accountId, classId);
      if (!classes.length) return { classes: [], note: 'Người hỏi không học lớp này hoặc chưa học lớp nào' };
      return {
        classes: await Promise.all(
          classes.map(async ({ id, name }) => {
            const training = await classTrainingService.myTraining(accountId, id);
            const plan = (value: typeof training.classPlan) =>
              value ? { goals: value.goals, content: value.content, updatedAt: value.updatedAt } : null;
            return {
              className: name,
              classPlan: plan(training.classPlan),
              myPlan: plan(training.myPlan),
              reviews: training.reviews.map(({ milestone, technique, fitness, attitude, comment, coach }) => ({
                milestone: milestone === 'MID' ? 'Giữa khóa' : 'Cuối khóa',
                technique,
                fitness,
                attitude,
                comment,
                coach: coach.fullName,
              })),
            };
          }),
        ),
        scale: 'Điểm từ 1 đến 5',
      };
    },
  ),
  tool(
    {
      name: 'my_progress',
      description: `Tiến độ của người hỏi: số buổi có mặt/muộn/vắng, ${RECENT_RESULTS} kết quả buổi gần nhất (điểm 1–5 và nhận xét của HLV), ghi chú và bài tập về nhà của các buổi gần đây. Bỏ trống classId để lấy mọi lớp đang học.`,
      parameters: {
        type: 'OBJECT',
        properties: { classId: { type: 'STRING', description: 'Mã lớp (từ my_enrollments)' } },
        required: [],
      },
    },
    optionalClass,
    async ({ accountId }, { classId }) => {
      const classes = await enrolledClassIds(accountId, classId);
      if (!classes.length) return { note: 'Người hỏi không học lớp này hoặc chưa học lớp nào' };
      const ids = classes.map(({ id }) => id);
      const [attendance, results, notes] = await Promise.all([
        assistantRepository.countAttendance(accountId, ids),
        assistantRepository.findRecentResults(accountId, ids, RECENT_RESULTS),
        assistantRepository.findSessionNotes(ids, new Date(todayInCenter()), 3),
      ]);
      const count = (status: string) => attendance.find((row) => row.status === status)?._count ?? 0;
      return {
        classes: classes.map(({ name }) => name),
        attendance: { present: count('PRESENT'), late: count('LATE'), absent: count('ABSENT') },
        recentResults: results.map(({ rating, comment, session }) => ({
          className: session.class.name,
          session: session.sessionNumber,
          date: formatDate(session.sessionDate),
          rating,
          comment,
        })),
        recentNotes: notes.map((note) => ({
          className: note.class.name,
          session: note.sessionNumber,
          date: formatDate(note.sessionDate),
          title: note.noteTitle,
          content: note.noteContent,
          homework: note.noteHomework,
        })),
      };
    },
  ),
  tool(
    { name: 'my_wallet', description: 'Số dư ví của người hỏi và 5 giao dịch gần nhất.' },
    noArgs,
    async ({ accountId }) => {
      const wallet = await walletService.getForMember(accountId, { page: 1, limit: 5 });
      return {
        balanceVnd: wallet.balance,
        recentTransactions: wallet.transactions.items.map((tx) => ({
          type: tx.type === 'TOP_UP' ? 'Nạp tiền' : tx.type === 'PAYMENT' ? 'Thanh toán' : 'Hoàn tiền',
          amountVnd: tx.amount,
          balanceAfterVnd: tx.balanceAfter,
          description: tx.description,
          at: tx.createdAt,
        })),
      };
    },
  ),
  tool(
    {
      name: 'my_memberships',
      description:
        'Gói thành viên hiện tại của người hỏi: tên gói, ngày bắt đầu/hết hạn, tự gia hạn, quyền lợi, slot miễn phí đã dùng tháng này.',
    },
    noArgs,
    async ({ accountId }) => {
      const { current } = await memberMembershipService.list(accountId);
      if (!current) return { current: null, note: 'Người hỏi chưa có gói thành viên' };
      return {
        current: {
          name: current.package.name,
          status: current.status,
          startDate: current.startDate,
          endDate: current.endDate,
          autoRenew: current.autoRenew,
          benefits: current.currentBenefits,
          freeSlotsUsedThisMonth: current.freeSlotsUsedThisMonth,
        },
        today: todayInCenter(),
      };
    },
  ),
  tool(
    { name: 'my_bookings', description: 'Các lần đặt sân sắp tới của người hỏi (từ hôm nay).' },
    noArgs,
    async ({ accountId }) => {
      const page = await bookingService.listMine(accountId, { page: 1, limit: 10, from: todayInCenter() });
      return {
        bookings: page.items.map((booking) => ({
          facility: booking.facility.name,
          date: booking.date,
          weekday: weekdayOf(booking.date),
          time: `${booking.startTime}–${booking.endTime}`,
          status: booking.status,
          paidVnd: booking.paidAmount,
        })),
      };
    },
  ),
  tool(
    {
      name: 'draft_support_request',
      description:
        'Soạn sẵn một yêu cầu hỗ trợ gửi lễ tân khi người hỏi gặp sự cố mà trợ lý không tự giải quyết được (ví dụ nạp tiền chưa cộng, lỗi đặt sân). KHÔNG gửi đi: người hỏi sẽ tự xem và bấm gửi.',
      parameters: {
        type: 'OBJECT',
        properties: {
          category: { type: 'STRING', enum: [...SUPPORT_CATEGORIES], description: 'Loại yêu cầu' },
          subject: { type: 'STRING', description: 'Tiêu đề ngắn, tối đa 120 ký tự' },
          description: { type: 'STRING', description: 'Mô tả vấn đề, kèm dữ liệu liên quan đã tra được' },
        },
        required: ['category', 'subject', 'description'],
      },
    },
    createSupportBodySchema,
    async (_context, draft) =>
      prepared({ type: 'SUPPORT_REQUEST', draft }, 'Chưa gửi: người hỏi tự xem lại và bấm gửi.'),
  ),
  tool(
    {
      name: 'compare_memberships',
      description:
        'Tư vấn gói thành viên: chi tiêu đặt sân/lớp của người hỏi trong 60 ngày qua (quy ra mỗi tháng) so với từng gói đang bán, đã tính sẵn tổng mỗi tháng và số tiền tiết kiệm. Dùng khi họ hỏi nên mua gói nào, gói nào lợi, có nên mua gói không.',
    },
    noArgs,
    async ({ accountId }) => compareMemberships(accountId),
  ),
  tool(
    {
      name: 'propose_cart_item',
      description:
        'Chuẩn bị một dịch vụ để người hỏi thêm vào giỏ hàng: đặt một slot sân (FACILITY_BOOKING), đăng ký một lớp (COURSE_ENROLLMENT) hoặc mua một gói thành viên (MEMBERSHIP). Dùng khi người hỏi muốn đặt/đăng ký/mua. Kiểm tra trước còn chỗ và tính giá theo quyền lợi của họ. KHÔNG thêm vào giỏ, KHÔNG thanh toán: người hỏi tự bấm "Thêm vào giỏ" rồi thanh toán ở giỏ hàng.',
      parameters: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', enum: ['FACILITY_BOOKING', 'COURSE_ENROLLMENT', 'MEMBERSHIP'] },
          facilityId: { type: 'STRING', description: 'FACILITY_BOOKING: mã sân từ list_facilities' },
          date: { type: 'STRING', format: 'date', description: 'FACILITY_BOOKING: ngày, YYYY-MM-DD' },
          startTime: { type: 'STRING', description: 'FACILITY_BOOKING: giờ bắt đầu slot, HH:mm' },
          endTime: { type: 'STRING', description: 'FACILITY_BOOKING: giờ kết thúc slot, HH:mm' },
          classId: { type: 'STRING', description: 'COURSE_ENROLLMENT: mã lớp từ list_open_classes' },
          packageId: { type: 'STRING', description: 'MEMBERSHIP: mã gói từ list_memberships' },
        },
        required: ['type'],
      },
    },
    checkoutItemInputSchema.refine(({ type }) => type !== 'FACILITY_PACKAGE', 'Không hỗ trợ gói sân định kỳ'),
    async ({ accountId }, item) => {
      const quote = await checkoutService.quote({ id: accountId, role: 'MEMBER' }, { items: [item] });
      const line = quote.items[0]!;
      if (!line.valid) return { error: line.error?.message ?? 'Dịch vụ này hiện không đặt được' };
      const name = typeof line.snapshot?.title === 'string' ? line.snapshot.title : 'Dịch vụ';
      const title =
        item.type === 'FACILITY_BOOKING'
          ? `${name} · ${weekdayOf(item.date)} ${item.date.slice(8, 10)}/${item.date.slice(5, 7)} · ${item.startTime}–${item.endTime}`
          : name;
      return {
        ...prepared(
          { type: 'CART_ITEM', item, title, subtotal: line.subtotal, total: line.total },
          'Chưa thêm vào giỏ: người hỏi tự bấm "Thêm vào giỏ" ngay dưới câu trả lời rồi thanh toán ở giỏ hàng. Báo người hỏi giá phải trả là totalVnd (đã trừ quyền lợi gói, có thể 0đ nhờ slot miễn phí), không phải listPriceVnd.',
        ),
        title,
        listPriceVnd: line.subtotal,
        totalVnd: line.total,
      };
    },
  ),
];
