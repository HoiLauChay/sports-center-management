import { ORDER_ITEM_TYPES } from '@sports-center/shared';
import { z } from 'zod';

import managerAiRepository from '~/repositories/managerAi.repository';
import { vnd } from '~/services/ai/aiText';
import managerInsightsService from '~/services/ai/managerInsights.service';
import { RECEPTION_TOOLS } from '~/services/ai/tools/reception';
import {
  classIdArg,
  isoDate,
  noArgs,
  prepared,
  tool,
  WEEKDAYS,
  type Tool,
  type ToolParameters,
} from '~/services/ai/tools/toolkit';
import bankTransactionService from '~/services/bankTransaction.service';
import classService from '~/services/class.service';
import maintenanceService from '~/services/maintenance.service';
import reportService from '~/services/report.service';
import supportService from '~/services/support.service';
import { addDays, formatCenterDateTime, todayInCenter } from '~/utils/time';

const MAX_REPORT_DAYS = 366;
const MAX_RECONCILIATION_DAYS = 31;
const MAX_ROWS = 10;

const managerOf = (accountId: string) => ({ id: accountId, role: 'MANAGER' as const });

const rangeParams: ToolParameters = {
  type: 'OBJECT',
  properties: {
    from: { type: 'STRING', format: 'date', description: 'Từ ngày, YYYY-MM-DD; bỏ trống là ngày 1 tháng này' },
    to: { type: 'STRING', format: 'date', description: 'Đến ngày, YYYY-MM-DD; bỏ trống là hôm nay' },
  },
  required: [],
};
const granularParams: ToolParameters = {
  ...rangeParams,
  properties: {
    ...rangeParams.properties,
    granularity: { type: 'STRING', enum: ['day', 'week', 'month'], description: 'Gộp theo ngày, tuần hoặc tháng' },
  },
} as ToolParameters;
const rangeArgs = z.object({ from: isoDate.optional(), to: isoDate.optional() });
const granularArgs = rangeArgs.extend({ granularity: z.enum(['day', 'week', 'month']).optional() });

/** Defaults to month-to-date; null when the range is backwards or longer than the reports allow. */
const reportRange = (args: { from?: string; to?: string }, maxDays = MAX_REPORT_DAYS) => {
  const today = todayInCenter();
  const to = args.to ?? today;
  const from = args.from ?? `${to.slice(0, 8)}01`;
  return from > to || from < addDays(to, -(maxDays - 1)) ? null : { from, to };
};
const badReportRange = (days = MAX_REPORT_DAYS) => ({ error: `Khoảng ngày phải hợp lệ và tối đa ${days} ngày` });

/** Biggest lists keep their lowest and highest rows only, so the model is not buried in data. */
const edges = <T>(rows: T[], by: (row: T) => number) => {
  if (rows.length <= MAX_ROWS) return { rows, trimmed: false };
  const sorted = [...rows].sort((a, b) => by(a) - by(b));
  return { rows: [...sorted.slice(0, MAX_ROWS / 2), ...sorted.slice(-MAX_ROWS / 2)], trimmed: true };
};

const pick = (names: string[]) => RECEPTION_TOOLS.filter(({ declaration }) => names.includes(declaration.name));

/**
 * The manager's tools: reports, the work waiting on them, and four prepared actions (approve a class, credit a
 * transfer, assign a coach, create a coupon) that only happen when the manager presses the card's button.
 */
export const MANAGER_TOOLS: Tool[] = [
  tool(
    {
      name: 'center_overview',
      description:
        'Tình hình hôm nay: doanh thu, hội viên mới, lượt đặt sân, lớp đang chạy, gói đang hoạt động, giao dịch ngân hàng chưa khớp.',
    },
    noArgs,
    async () => ({ today: todayInCenter(), ...(await reportService.overview()) }),
  ),
  tool(
    {
      name: 'revenue_report',
      description:
        'Doanh thu theo kỳ: doanh thu, hoàn tiền, thực thu (net), chia theo loại dịch vụ (byType) và phương thức thanh toán (byPaymentMethod). Đã tính sẵn tổng cả khoảng (totals).',
      parameters: granularParams,
    },
    granularArgs,
    async (_context, args) => {
      const range = reportRange(args);
      if (!range) return badReportRange();
      const granularity = args.granularity ?? 'day';
      const { buckets } = await reportService.revenue({ ...range, granularity });
      const totals = {
        revenue: buckets.reduce((s, b) => s + b.revenue, 0),
        refunds: buckets.reduce((s, b) => s + b.refunds, 0),
        net: buckets.reduce((s, b) => s + b.net, 0),
        byType: Object.fromEntries(
          ORDER_ITEM_TYPES.map((type) => [type, buckets.reduce((s, b) => s + b.byType[type], 0)]),
        ),
      };
      return {
        ...range,
        granularity,
        totals,
        buckets: buckets.slice(-31),
        typeMeaning:
          'MEMBERSHIP gói thành viên, FACILITY_BOOKING đặt sân, FACILITY_PACKAGE gói sân, COURSE_ENROLLMENT lớp học',
      };
    },
  ),
  tool(
    {
      name: 'wallet_report',
      description:
        'Ví hội viên theo kỳ: nạp chuyển khoản, nạp tại quầy (tiền mặt/thẻ), thanh toán bằng ví, hoàn tiền vào ví, tổng số dư hiện tại, giao dịch chưa khớp.',
      parameters: granularParams,
    },
    granularArgs,
    async (_context, args) => {
      const range = reportRange(args);
      if (!range) return badReportRange();
      const wallet = await reportService.wallet({ ...range, granularity: args.granularity ?? 'day' });
      return { ...range, ...wallet, buckets: wallet.buckets.slice(-31) };
    },
  ),
  tool(
    {
      name: 'members_report',
      description:
        'Hội viên: tổng theo trạng thái tài khoản, gói đang hoạt động, gói sắp hết hạn, tỉ lệ gia hạn (%) và số hội viên mới trong khoảng.',
      parameters: rangeParams,
    },
    rangeArgs,
    async (_context, args) => {
      const range = reportRange(args);
      if (!range) return badReportRange();
      const { newByPeriod, ...members } = await reportService.members(range);
      return { ...range, ...members, newMembers: newByPeriod.reduce((s, { count }) => s + count, 0) };
    },
  ),
  tool(
    {
      name: 'facility_utilization',
      description:
        'Sân và phòng: tỉ lệ lấp chung, từng sân (lượt đặt, % lấp, doanh thu). Danh sách dài chỉ giữ 5 sân thấp nhất và 5 cao nhất.',
      parameters: rangeParams,
    },
    rangeArgs,
    async (_context, args) => {
      const range = reportRange(args);
      if (!range) return badReportRange();
      const report = await reportService.facilities(range);
      const { rows, trimmed } = edges(report.byFacility, (row) => row.occupancyPct);
      return {
        ...range,
        utilizationRate: report.utilizationRate,
        facilities: rows.map(({ facilityId: _id, ...row }) => row),
        trimmed,
      };
    },
  ),
  tool(
    {
      name: 'class_performance',
      description:
        'Lớp học: sĩ số, tỉ lệ lấp (%), chuyên cần (%) từng lớp và HLV có nhiều học viên nhất. Danh sách dài chỉ giữ 5 lớp thấp nhất và 5 cao nhất theo tỉ lệ lấp.',
      parameters: rangeParams,
    },
    rangeArgs,
    async (_context, args) => {
      const range = reportRange(args);
      if (!range) return badReportRange();
      const report = await reportService.courses(range);
      const { rows, trimmed } = edges(report.byClass, (row) => row.fillRate);
      return {
        ...range,
        classes: rows.map(({ classId, ...row }) => ({ classId, ...row })),
        trimmed,
        topCoaches: report.topCoaches.slice(0, 5).map(({ coach, students }) => ({ coach: coach.fullName, students })),
      };
    },
  ),
  tool(
    {
      name: 'weekly_digest',
      description:
        'Bản tóm tắt tuần trước (thứ 2–chủ nhật) so với tuần trước nữa: thực thu, lượt đặt, tỉ lệ lấp sân, hội viên mới, gói sắp hết hạn, khung giờ vắng.',
    },
    noArgs,
    async () => managerInsightsService.weeklyDigest(),
  ),
  tool(
    {
      name: 'manager_todo',
      description:
        'Việc đang chờ Manager: lớp chờ duyệt, lớp chưa có HLV, giao dịch ngân hàng chưa khớp, yêu cầu hỗ trợ đang mở, lịch bảo trì 14 ngày tới.',
    },
    noArgs,
    async () => {
      const now = new Date();
      const today = todayInCenter(now);
      const [pendingClasses, needCoach, unmatched, support, maintenances] = await Promise.all([
        managerAiRepository.countPendingClasses(),
        managerAiRepository.countClassesNeedingCoach(new Date(today)),
        managerAiRepository.findStaleUnmatched(now),
        supportService.list({ page: 1, limit: 1, status: 'OPEN' }),
        managerAiRepository.countUpcomingMaintenances(now, new Date(now.getTime() + 14 * 86_400_000)),
      ]);
      return {
        pendingClasses,
        classesNeedingCoach: needCoach,
        unmatchedBankTransactions: { count: unmatched.count, amountVnd: unmatched.amount },
        openSupportRequests: support.total,
        upcomingMaintenances: maintenances,
      };
    },
  ),
  tool(
    {
      name: 'pending_classes',
      description:
        'Lớp đang chờ duyệt hoặc chưa có HLV: mã lớp, tên, bộ môn, HLV, lịch tuần, ngày bắt đầu, sĩ số tối thiểu/tối đa.',
      parameters: {
        type: 'OBJECT',
        properties: {
          kind: {
            type: 'STRING',
            enum: ['PENDING_APPROVAL', 'NEEDS_COACH'],
            description: 'PENDING_APPROVAL lớp chờ duyệt (mặc định), NEEDS_COACH lớp đã mở chưa có HLV',
          },
        },
        required: [],
      },
    },
    z.object({ kind: z.enum(['PENDING_APPROVAL', 'NEEDS_COACH']).default('PENDING_APPROVAL') }),
    async ({ accountId }, { kind }) => {
      const page = await classService.list(
        managerOf(accountId),
        kind === 'PENDING_APPROVAL'
          ? { page: 1, limit: MAX_ROWS, status: 'PENDING_APPROVAL' }
          : { page: 1, limit: MAX_ROWS, status: 'OPEN', needsCoach: true },
      );
      return {
        total: page.total,
        classes: page.items.map((cls) => ({
          classId: cls.id,
          name: cls.name,
          sport: cls.course.sport.name,
          coach: cls.coach?.fullName ?? null,
          facility: cls.facility.name,
          weeklySchedule: cls.weeklySchedule.map((slot) => ({ ...slot, weekday: WEEKDAYS[slot.dayOfWeek] })),
          startDate: cls.startDate,
          students: `${cls.enrolledCount} (tối thiểu ${cls.minStudents}, tối đa ${cls.maxStudents})`,
          scheduleConflict: cls.scheduleConflict ?? false,
        })),
      };
    },
  ),
  tool(
    {
      name: 'class_review',
      description:
        'Kiểm tra một lớp chờ duyệt: các mục kiểm tra (HLV, chuyên môn, trùng lịch, ngày bắt đầu, số buổi, sĩ số), kết luận nên duyệt/từ chối/xem kỹ và tóm tắt. Cần mã lớp từ pending_classes.',
      parameters: {
        type: 'OBJECT',
        properties: { classId: { type: 'STRING', description: 'Mã lớp (classId từ pending_classes)' } },
        required: ['classId'],
      },
    },
    classIdArg,
    async ({ accountId }, { classId }) => managerInsightsService.classReview(accountId, classId),
  ),
  tool(
    {
      name: 'class_coach_options',
      description:
        'HLV có thể dạy một lớp: ai đã đăng ký, ai có chuyên môn bộ môn đã duyệt, số lớp đang dạy, có trùng giờ không; đã chấm điểm phù hợp (score). Cần mã lớp từ pending_classes.',
      parameters: {
        type: 'OBJECT',
        properties: { classId: { type: 'STRING', description: 'Mã lớp (classId từ pending_classes)' } },
        required: ['classId'],
      },
    },
    classIdArg,
    async ({ accountId }, { classId }) => {
      const { class: cls, candidates } = await managerInsightsService.coachSuggestions(accountId, classId);
      return {
        class: cls,
        coaches: candidates.map(({ coach, registrationId, score, reasons, available }) => ({
          coachId: coach.id,
          name: coach.fullName,
          registered: Boolean(registrationId),
          score,
          available,
          reasons,
        })),
      };
    },
  ),
  tool(
    {
      name: 'unmatched_bank_transactions',
      description:
        'Chuyển khoản chưa khớp với hội viên nào (10 giao dịch cũ nhất): mã giao dịch, số tiền, nội dung, thời điểm, lý do chưa khớp.',
    },
    noArgs,
    async () => {
      const page = await bankTransactionService.list({ page: 1, limit: MAX_ROWS, status: 'UNMATCHED' });
      return {
        total: page.total,
        transactions: page.items.map((row) => ({
          transactionId: row.id,
          amountVnd: row.amount,
          content: row.content,
          at: formatCenterDateTime(row.transactionDate),
          issue: row.issue,
        })),
      };
    },
  ),
  tool(
    {
      name: 'bank_match_candidates',
      description:
        'Hội viên có thể là người chuyển một khoản chưa khớp, đã chấm điểm (score 0–100) kèm lý do (SĐT/tên trong nội dung, hóa đơn cùng số tiền, mã thanh toán). Cần mã giao dịch từ unmatched_bank_transactions.',
      parameters: {
        type: 'OBJECT',
        properties: { transactionId: { type: 'STRING', description: 'Mã giao dịch (transactionId)' } },
        required: ['transactionId'],
      },
    },
    z.object({ transactionId: z.uuid('Mã giao dịch không hợp lệ') }),
    async (_context, { transactionId }) => ({
      candidates: (await managerInsightsService.bankSuggestions(transactionId)).map(({ account, score, reasons }) => ({
        memberId: account.id,
        name: account.fullName,
        phone: account.phone,
        score,
        reasons,
      })),
    }),
  ),
  tool(
    {
      name: 'bank_reconciliation',
      description: `Đối soát chuyển khoản theo ngày (tối đa ${MAX_RECONCILIATION_DAYS} ngày, mặc định 7 ngày qua): số giao dịch và số tiền phía SePay so với hệ thống, ngày nào lệch.`,
      parameters: rangeParams,
    },
    rangeArgs,
    async (_context, args) => {
      const today = todayInCenter();
      const range = reportRange(
        { from: args.from ?? addDays(args.to ?? today, -6), to: args.to },
        MAX_RECONCILIATION_DAYS,
      );
      if (!range) return badReportRange(MAX_RECONCILIATION_DAYS);
      const { days } = await bankTransactionService.reconcile(range);
      return { ...range, mismatchedDays: days.filter(({ matched }) => !matched), totalDays: days.length };
    },
  ),
  tool(
    {
      name: 'maintenance_schedule',
      description: 'Lịch bảo trì sân đang diễn ra và sắp tới (mặc định 30 ngày tới): sân, thời gian, lý do.',
      parameters: {
        type: 'OBJECT',
        properties: { facilityId: { type: 'STRING', description: 'Mã sân (từ list_facilities), không bắt buộc' } },
        required: [],
      },
    },
    z.object({ facilityId: z.uuid('Mã sân không hợp lệ').optional() }),
    async (_context, { facilityId }) => {
      const today = todayInCenter();
      const rows = await maintenanceService.list({ facilityId, from: today, to: addDays(today, 30) });
      return {
        maintenances: rows.slice(0, MAX_ROWS).map((row) => ({
          facility: row.facility.name,
          from: formatCenterDateTime(row.startAt),
          to: formatCenterDateTime(row.endAt),
          reason: row.reason,
        })),
      };
    },
  ),
  tool(
    {
      name: 'peak_hours',
      description:
        'Khung giờ đông nhất và vắng nhất theo thứ trong tuần (tỉ lệ lấp % trên mọi sân), mặc định 4 tuần qua.',
      parameters: rangeParams,
    },
    rangeArgs,
    async (_context, args) => {
      const today = todayInCenter();
      const range = reportRange({ from: args.from ?? addDays(today, -28), to: args.to ?? addDays(today, -1) }, 92);
      if (!range) return badReportRange(92);
      return managerInsightsService.peakHours(range.from, range.to);
    },
  ),
  tool(
    {
      name: 'coach_workload',
      description:
        'Khối lượng dạy của từng HLV trong khoảng (mặc định tháng này): số buổi, các lớp, số học viên, điểm đánh giá buổi học trung bình.',
      parameters: rangeParams,
    },
    rangeArgs,
    async (_context, args) => {
      const range = reportRange(args, 92);
      if (!range) return badReportRange(92);
      return managerInsightsService.coachWorkload(range.from, range.to);
    },
  ),
  tool(
    {
      name: 'quiet_hour_promos',
      description:
        'Khung giờ sân vắng 4 tuần qua (dưới ngưỡng % lấp, mặc định 30) kèm mức giảm giá gợi ý; dùng trước khi gọi propose_coupon.',
      parameters: {
        type: 'OBJECT',
        properties: { maxOccupancy: { type: 'STRING', description: 'Ngưỡng % lấp, ví dụ "30"' } },
        required: [],
      },
    },
    z.object({ maxOccupancy: z.coerce.number().int().min(5).max(80).default(30) }),
    async (_context, { maxOccupancy }) => ({
      promos: (await managerInsightsService.promoSuggestions(maxOccupancy)).map((promo) => ({
        ...promo,
        weekday: WEEKDAYS[promo.weekday],
      })),
    }),
  ),

  ...pick(['find_members', 'member_overview', 'support_queue', 'find_classes']),

  tool(
    {
      name: 'propose_class_review',
      description:
        'Chuẩn bị duyệt hoặc từ chối một lớp chờ duyệt (gọi class_review trước). KHÔNG thực hiện: Manager tự bấm "Duyệt lớp"/"Từ chối" trên thẻ dưới câu trả lời.',
      parameters: {
        type: 'OBJECT',
        properties: {
          classId: { type: 'STRING', description: 'Mã lớp' },
          decision: { type: 'STRING', enum: ['APPROVE', 'REJECT'], description: 'APPROVE duyệt, REJECT từ chối' },
          note: { type: 'STRING', description: 'Ghi chú gửi HLV, bắt buộc khi từ chối' },
        },
        required: ['classId', 'decision'],
      },
    },
    z.object({
      classId: z.uuid('Mã lớp không hợp lệ'),
      decision: z.enum(['APPROVE', 'REJECT']),
      note: z.string().trim().min(1).max(500).optional(),
    }),
    async ({ accountId }, { classId, decision, note }) => {
      const cls = await classService.get(managerOf(accountId), classId);
      if (cls.status !== 'PENDING_APPROVAL') return { error: 'Lớp này không ở trạng thái chờ duyệt' };
      if (decision === 'REJECT' && !note) return { error: 'Cần ghi lý do từ chối để gửi HLV' };
      return prepared(
        {
          type: 'CLASS_REVIEW',
          classId,
          title: `${cls.name} · ${cls.course.sport.name}`,
          decision,
          note: note ?? null,
        },
        `Chưa ${decision === 'APPROVE' ? 'duyệt' : 'từ chối'}: Manager tự kiểm tra và bấm nút trên thẻ ngay dưới câu trả lời.`,
      );
    },
  ),
  tool(
    {
      name: 'propose_bank_match',
      description:
        'Chuẩn bị ghi nhận một chuyển khoản chưa khớp vào ví một hội viên (gọi bank_match_candidates trước, chỉ đề xuất khi điểm cao và lý do rõ). KHÔNG thực hiện: Manager tự bấm "Ghi nhận" trên thẻ.',
      parameters: {
        type: 'OBJECT',
        properties: {
          transactionId: { type: 'STRING', description: 'Mã giao dịch' },
          memberId: { type: 'STRING', description: 'Mã hội viên (memberId từ bank_match_candidates)' },
        },
        required: ['transactionId', 'memberId'],
      },
    },
    z.object({ transactionId: z.uuid('Mã giao dịch không hợp lệ'), memberId: z.uuid('Mã hội viên không hợp lệ') }),
    async (_context, { transactionId, memberId }) => {
      const page = await bankTransactionService.list({ page: 1, limit: 100, status: 'UNMATCHED' });
      const transaction = page.items.find(({ id }) => id === transactionId);
      if (!transaction) return { error: 'Giao dịch không còn ở trạng thái chưa khớp' };
      const candidate = (await managerInsightsService.bankSuggestions(transactionId)).find(
        ({ account }) => account.id === memberId,
      );
      if (!candidate) return { error: 'Hội viên này không nằm trong danh sách gợi ý, hãy gọi bank_match_candidates' };
      return prepared(
        {
          type: 'BANK_MATCH',
          transactionId,
          title: `${vnd(transaction.amount)} · ${formatCenterDateTime(transaction.transactionDate)}`,
          amount: transaction.amount,
          account: { id: candidate.account.id, fullName: candidate.account.fullName, phone: candidate.account.phone },
          reasons: candidate.reasons,
          note: `Khớp theo gợi ý AI: ${candidate.reasons.join('; ')}`.slice(0, 500),
        },
        'Chưa ghi nhận: Manager tự kiểm tra và bấm "Ghi nhận vào ví" trên thẻ.',
      );
    },
  ),
  tool(
    {
      name: 'propose_coach_assignment',
      description:
        'Chuẩn bị phân công một HLV cho lớp (gọi class_coach_options trước, chỉ chọn HLV available). KHÔNG thực hiện: Manager tự bấm "Phân công" trên thẻ.',
      parameters: {
        type: 'OBJECT',
        properties: {
          classId: { type: 'STRING', description: 'Mã lớp' },
          coachId: { type: 'STRING', description: 'Mã HLV (coachId từ class_coach_options)' },
        },
        required: ['classId', 'coachId'],
      },
    },
    z.object({ classId: z.uuid('Mã lớp không hợp lệ'), coachId: z.uuid('Mã HLV không hợp lệ') }),
    async ({ accountId }, { classId, coachId }) => {
      const { class: cls, candidates } = await managerInsightsService.coachSuggestions(accountId, classId);
      const chosen = candidates.find(({ coach }) => coach.id === coachId);
      if (!chosen) return { error: 'HLV này không nằm trong danh sách phù hợp, hãy gọi class_coach_options' };
      if (!chosen.available) return { error: `HLV ${chosen.coach.fullName} đang trùng giờ với lớp khác` };
      return prepared(
        {
          type: 'ASSIGN_COACH',
          classId,
          title: `${cls.name} · ${cls.sport}`,
          coach: chosen.coach,
          registrationId: chosen.registrationId,
          reasons: chosen.reasons,
        },
        'Chưa phân công: Manager tự kiểm tra và bấm "Phân công" trên thẻ.',
      );
    },
  ),
  tool(
    {
      name: 'propose_coupon',
      description:
        'Chuẩn bị một mã giảm giá cho đặt sân giờ vắng (gọi quiet_hour_promos trước). Mã chỉ là giảm theo % cho dịch vụ đặt sân, hiệu lực từ hôm nay. KHÔNG tạo: Manager tự kiểm tra và bấm "Tạo mã" trên thẻ.',
      parameters: {
        type: 'OBJECT',
        properties: {
          code: { type: 'STRING', description: 'Mã viết hoa, chữ và số, ví dụ GIOVANG20' },
          name: { type: 'STRING', description: 'Tên hiển thị của mã' },
          percent: { type: 'STRING', description: 'Phần trăm giảm, 5–50' },
          days: { type: 'STRING', description: 'Số ngày hiệu lực, 1–60; mặc định 14' },
          reason: { type: 'STRING', description: 'Vì sao đề xuất mã này (khung giờ, tỉ lệ lấp)' },
        },
        required: ['code', 'name', 'percent', 'reason'],
      },
    },
    z.object({
      code: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9_-]{3,30}$/, 'Mã chỉ gồm chữ, số, gạch ngang, 3–30 ký tự'),
      name: z.string().trim().min(1).max(255),
      percent: z.coerce.number().int().min(5).max(50),
      days: z.coerce.number().int().min(1).max(60).default(14),
      reason: z.string().trim().min(1).max(300),
    }),
    async (_context, { code, name, percent, days, reason }) => {
      const now = new Date();
      const validTo = new Date(now.getTime() + days * 86_400_000);
      return prepared(
        {
          type: 'CREATE_COUPON',
          title: `${code} · giảm ${percent}% đặt sân · ${days} ngày`,
          reason,
          coupon: {
            code,
            name,
            discountType: 'PERCENT',
            discountValue: percent,
            maxUsesPerUser: 2,
            applicableTypes: ['FACILITY_BOOKING'],
            validFrom: now.toISOString(),
            validTo: validTo.toISOString(),
            isActive: true,
          },
        },
        'Chưa tạo: Manager tự kiểm tra và bấm "Tạo mã" trên thẻ. Mã áp dụng cho mọi giờ; ghi rõ khung giờ vắng trong tên để lễ tân và hội viên biết.',
      );
    },
  ),
];
