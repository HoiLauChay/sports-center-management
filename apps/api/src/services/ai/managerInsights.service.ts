import {
  ERROR_CODE,
  normalizePhone,
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  type AiText,
  type BankMatchCandidate,
  type ClassReviewCheck,
  type ClassReviewInsight,
  type ClassSummary,
  type DigestHighlight,
  type MaintenanceAnnounceBody,
  type MaintenanceNoticeDraft,
  type PromoSuggestion,
  type ReportInsightBody,
  type SupportCategory,
  type SupportPriority,
  type SupportTriage,
  type WeeklyDigest,
  type WeeklySlot,
} from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { toBankTransactionResponse } from '~/mappers/bankTransaction.mapper';
import { toMaintenanceResponse } from '~/mappers/maintenance.mapper';
import bankTransactionRepository from '~/repositories/bankTransaction.repository';
import maintenanceRepository from '~/repositories/maintenance.repository';
import managerAiRepository, { type MemberContactRow } from '~/repositories/managerAi.repository';
import { ErrorWithStatus } from '~/rules/error';
import { aiJson, aiParagraph, asData, cached, GUARD, pct, vnd } from '~/services/ai/aiText';
import { WEEKDAYS } from '~/services/ai/tools/toolkit';
import classService from '~/services/class.service';
import notificationService, { type NotificationInput } from '~/services/notification.service';
import reportService from '~/services/report.service';
import specializationService from '~/services/specialization.service';
import supportService from '~/services/support.service';
import { addDays, formatCenterDateTime, formatDate, formatTime, parseTime, todayInCenter } from '~/utils/time';

const DAY_MS = 86_400_000;
const DIGEST_TTL_SECONDS = 8 * 24 * 60 * 60;
const MAX_ROWS = 10;
const PROMO_LOOKBACK_DAYS = 28;
const MAX_PROMOS = 3;

const manager = (id: string) => ({ id, role: 'MANAGER' as const });

const notFound = (message: string) =>
  new ErrorWithStatus({ status: HTTP_STATUS.NOT_FOUND, code: ERROR_CODE.NOT_FOUND, message });

const change = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 1000) / 10 : null);

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const average = (values: number[]) => (values.length ? sum(values) / values.length : 0);

/** Monday of the week `date` falls in. */
const mondayOf = (date: string) => addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));

type Contact = Omit<MemberContactRow, 'email'> & { email: string | null };

const contact = (row: Contact) => ({
  id: row.id,
  fullName: row.fullName,
  phone: row.phone,
  email: row.email,
});

const REPORT_BRIEF: Record<ReportInsightBody['report'], string> = {
  overview: 'tình hình trong ngày',
  revenue: 'doanh thu theo kỳ (doanh thu, hoàn tiền, thực thu, theo loại dịch vụ và phương thức thanh toán)',
  wallet: 'ví hội viên (nạp chuyển khoản, nạp tại quầy, thanh toán, hoàn tiền, tổng số dư)',
  members: 'hội viên (theo trạng thái, gói đang hoạt động, sắp hết hạn, tỉ lệ gia hạn, hội viên mới)',
  facilities: 'sân và phòng (tỉ lệ lấp, số lượt đặt, doanh thu từng sân)',
  courses: 'lớp học (sĩ số, tỉ lệ lấp, chuyên cần, HLV có nhiều học viên)',
};

const INSIGHT_SYSTEM = `Bạn là trợ lý phân tích cho Manager của một trung tâm thể thao ở Việt Nam.
Viết một đoạn nhận xét tiếng Việt 3–5 câu về báo cáo được cung cấp: điểm nổi bật, điểm bất thường (tăng/giảm mạnh, sân hoặc lớp quá thấp) và 1–2 gợi ý hành động cụ thể.
Tiền viết dạng 150.000đ, phần trăm dạng 45%. Không dùng tiêu đề, bảng hay chữ đậm.`;

const weeklyMatch = (a: WeeklySlot, b: WeeklySlot) =>
  a.dayOfWeek === b.dayOfWeek &&
  parseTime(a.startTime) < parseTime(b.endTime) &&
  parseTime(b.startTime) < parseTime(a.endTime);

const datesOverlap = (a: ClassSummary, b: ClassSummary) =>
  (a.startDate ?? '0000') <= (b.endDate ?? '9999') && (b.startDate ?? '0000') <= (a.endDate ?? '9999');

class ManagerInsightsService {
  /** Report data trimmed for the model: the biggest lists keep their worst and best rows only. */
  reportData = async ({ report, ...range }: ReportInsightBody) => {
    const edges = <T>(rows: T[], by: (row: T) => number) => {
      if (rows.length <= MAX_ROWS) return rows;
      const sorted = [...rows].sort((a, b) => by(a) - by(b));
      return [...sorted.slice(0, MAX_ROWS / 2), ...sorted.slice(-MAX_ROWS / 2)];
    };
    switch (report) {
      case 'overview':
        return reportService.overview();
      case 'revenue':
        return { buckets: (await reportService.revenue(range)).buckets.slice(-31) };
      case 'wallet': {
        const wallet = await reportService.wallet(range);
        return { ...wallet, buckets: wallet.buckets.slice(-31) };
      }
      case 'members': {
        const members = await reportService.members(range);
        return { ...members, newByPeriod: members.newByPeriod.slice(-31) };
      }
      case 'facilities': {
        const facilities = await reportService.facilities(range);
        return { ...facilities, byFacility: edges(facilities.byFacility, (row) => row.occupancyPct) };
      }
      case 'courses': {
        const courses = await reportService.courses(range);
        return {
          byClass: edges(courses.byClass, (row) => row.fillRate),
          topCoaches: courses.topCoaches
            .slice(0, 5)
            .map(({ coach, students }) => ({ coach: coach.fullName, students })),
        };
      }
    }
  };

  reportInsight = async (body: ReportInsightBody): Promise<AiText> => {
    const data = await this.reportData(body);
    const { value, ai } = await aiParagraph(
      `${INSIGHT_SYSTEM}\nBáo cáo: ${REPORT_BRIEF[body.report]}, ${
        // The overview tab is always today's figures, whatever range the other tabs are set to.
        body.report === 'overview'
          ? `chỉ số liệu trong ngày hôm nay ${formatCenterDateTime(todayInCenter())}`
          : `từ ${formatCenterDateTime(body.from)} đến ${formatCenterDateTime(body.to)}`
      }.`,
      data,
      () => this.reportFallback(body.report, data),
    );
    return { text: value, ai, generatedAt: new Date().toISOString() };
  };

  private reportFallback = (report: ReportInsightBody['report'], data: unknown): string => {
    const row = data as Record<string, unknown>;
    if (report === 'overview') {
      const o = row as {
        revenueToday: number;
        bookingsToday: number;
        newMembersToday: number;
        unmatchedBankTransactions: number;
      };
      return `Hôm nay thu ${vnd(o.revenueToday)}, ${o.bookingsToday} lượt đặt sân và ${o.newMembersToday} hội viên mới; còn ${o.unmatchedBankTransactions} giao dịch ngân hàng chưa khớp.`;
    }
    if (report === 'revenue') {
      const buckets = (row as { buckets: { revenue: number; refunds: number; net: number }[] }).buckets;
      return `Tổng doanh thu ${vnd(sum(buckets.map((b) => b.revenue)))}, hoàn ${vnd(sum(buckets.map((b) => b.refunds)))}, thực thu ${vnd(sum(buckets.map((b) => b.net)))}.`;
    }
    if (report === 'wallet') {
      const w = row as { totalBalance: number; unmatched: { count: number; amount: number } };
      return `Tổng số dư ví hội viên ${vnd(w.totalBalance)}; ${w.unmatched.count} giao dịch chưa khớp (${vnd(w.unmatched.amount)}).`;
    }
    if (report === 'members') {
      const m = row as { activeMemberships: number; expiringSoon: number; renewalRate: number };
      return `${m.activeMemberships} gói đang hoạt động, ${m.expiringSoon} gói sắp hết hạn, tỉ lệ gia hạn ${pct(m.renewalRate)}.`;
    }
    if (report === 'facilities') {
      const f = row as { utilizationRate: number; byFacility: { name: string; occupancyPct: number }[] };
      const lowest = [...f.byFacility].sort((a, b) => a.occupancyPct - b.occupancyPct)[0];
      return `Tỉ lệ lấp sân chung ${pct(f.utilizationRate)}${lowest ? `; thấp nhất là ${lowest.name} (${pct(lowest.occupancyPct)})` : ''}.`;
    }
    const c = row as { byClass: { name: string; fillRate: number; attendanceRate: number }[] };
    const lowest = [...c.byClass].sort((a, b) => a.fillRate - b.fillRate)[0];
    return `Tỉ lệ lấp lớp trung bình ${pct(average(c.byClass.map((r) => r.fillRate)))}, chuyên cần ${pct(average(c.byClass.map((r) => r.attendanceRate)))}${lowest ? `; lớp ít người nhất là ${lowest.name}` : ''}.`;
  };

  /** Busiest and quietest weekday × hour across all facilities (or one sport's) over the range. */
  peakHours = async (from: string, to: string) => {
    const cells = await reportService.occupancyBySlot({ from, to });
    const grouped = new Map<
      string,
      { weekday: number; start: number; end: number; available: number; occupied: number }
    >();
    for (const cell of cells) {
      const key = `${cell.weekday}:${cell.start}`;
      const row = grouped.get(key) ?? {
        weekday: cell.weekday,
        start: cell.start,
        end: cell.end,
        available: 0,
        occupied: 0,
      };
      row.available += cell.available;
      row.occupied += cell.occupied;
      grouped.set(key, row);
    }
    const rows = [...grouped.values()]
      .filter(({ available }) => available > 0)
      .map((row) => ({
        weekday: WEEKDAYS[row.weekday]!,
        time: `${formatTime(row.start)}–${formatTime(row.end)}`,
        occupancyPct: Math.round((row.occupied / row.available) * 1000) / 10,
      }))
      .sort((a, b) => b.occupancyPct - a.occupancyPct);
    return { from, to, busiest: rows.slice(0, 5), quietest: rows.slice(-5).reverse() };
  };

  coachWorkload = async (from: string, to: string) => {
    const sessions = await managerAiRepository.findSessionsForWorkload(new Date(from), new Date(to));
    const coaches = new Map<
      string,
      { coach: string; sessions: number; classes: Set<string>; students: number; ratings: number[] }
    >();
    const counted = new Set<string>();
    for (const session of sessions) {
      const coach = session.coach ?? session.class.coach;
      if (!coach) continue;
      const row = coaches.get(coach.id) ?? {
        coach: coach.fullName,
        sessions: 0,
        classes: new Set(),
        students: 0,
        ratings: [],
      };
      row.sessions += 1;
      if (!counted.has(`${coach.id}:${session.classId}`)) {
        counted.add(`${coach.id}:${session.classId}`);
        row.classes.add(session.class.name);
        row.students += session.class._count.enrollments;
      }
      row.ratings.push(...session.evaluations.map(({ rating }) => rating));
      coaches.set(coach.id, row);
    }
    return {
      from,
      to,
      coaches: [...coaches.values()]
        .map((row) => ({
          coach: row.coach,
          sessions: row.sessions,
          classes: [...row.classes],
          students: row.students,
          averageRating: row.ratings.length ? Math.round(average(row.ratings) * 10) / 10 : null,
        }))
        .sort((a, b) => b.sessions - a.sessions),
      scale: 'Điểm đánh giá buổi học từ 1 đến 5',
    };
  };

  /** Facility × weekday × slot that stayed under `threshold`% over the last four weeks, with a discount to try. */
  promoSuggestions = async (threshold: number, now = new Date()): Promise<PromoSuggestion[]> => {
    const today = todayInCenter(now);
    const cells = await reportService.occupancyBySlot({
      from: addDays(today, -PROMO_LOOKBACK_DAYS),
      to: addDays(today, -1),
    });
    return cells
      .filter(({ available }) => available > 0)
      .map((cell) => ({ ...cell, occupancyPct: Math.round((cell.occupied / cell.available) * 1000) / 10 }))
      .filter(({ occupancyPct }) => occupancyPct < threshold)
      .sort((a, b) => a.occupancyPct - b.occupancyPct)
      .slice(0, MAX_PROMOS)
      .map((cell) => ({
        facility: { id: cell.facilityId, name: cell.facility },
        weekday: cell.weekday,
        startTime: formatTime(cell.start),
        endTime: formatTime(cell.end),
        occupancyPct: cell.occupancyPct,
        discountPct: cell.occupancyPct < 10 ? 30 : cell.occupancyPct < 20 ? 20 : 10,
      }));
  };

  /** Last full week (Monday–Sunday) against the one before, written up once and cached for the week. */
  weeklyDigest = (now = new Date(), promoThreshold = 30): Promise<WeeklyDigest> => {
    const from = addDays(mondayOf(todayInCenter(now)), -7);
    return cached(`manager-digest:${from}:${promoThreshold}`, DIGEST_TTL_SECONDS, () =>
      this.buildDigest(from, promoThreshold, now),
    );
  };

  private buildDigest = async (from: string, promoThreshold: number, now: Date): Promise<WeeklyDigest> => {
    const to = addDays(from, 6);
    const before = { from: addDays(from, -7), to: addDays(from, -1) };
    const [revenue, previousRevenue, facilities, previousFacilities, members, courses, promos, pending] =
      await Promise.all([
        reportService.revenue({ from, to, granularity: 'week' }),
        reportService.revenue({ ...before, granularity: 'week' }),
        reportService.facilities({ from, to }),
        reportService.facilities(before),
        reportService.members({ from, to }, now),
        reportService.courses({ from, to }),
        this.promoSuggestions(promoThreshold, now),
        Promise.all([
          managerAiRepository.countPendingClasses(),
          managerAiRepository.countClassesNeedingCoach(new Date(todayInCenter(now))),
          managerAiRepository.findStaleUnmatched(now),
        ]),
      ]);
    const net = sum(revenue.buckets.map((bucket) => bucket.net));
    const previousNet = sum(previousRevenue.buckets.map((bucket) => bucket.net));
    const bookings = sum(facilities.byFacility.map((row) => row.bookings));
    const previousBookings = sum(previousFacilities.byFacility.map((row) => row.bookings));
    const newMembers = sum(members.newByPeriod.map(({ count }) => count));
    const fill = average(courses.byClass.map((row) => row.fillRate));
    const attendance = average(
      courses.byClass.filter((row) => row.attendanceRate > 0).map((row) => row.attendanceRate),
    );
    const highlights: DigestHighlight[] = [
      { label: 'Thực thu', value: vnd(net), change: change(net, previousNet) },
      { label: 'Lượt đặt sân', value: String(bookings), change: change(bookings, previousBookings) },
      {
        label: 'Tỉ lệ lấp sân',
        value: pct(facilities.utilizationRate),
        change: change(facilities.utilizationRate, previousFacilities.utilizationRate),
      },
      { label: 'Hội viên mới', value: String(newMembers), change: null },
      { label: 'Gói sắp hết hạn', value: String(members.expiringSoon), change: null },
      { label: 'Tỉ lệ lấp lớp', value: pct(fill), change: null },
      { label: 'Chuyên cần', value: pct(attendance), change: null },
    ];
    const [pendingClasses, needCoach, unmatched] = pending;
    const lowestFacility = [...facilities.byFacility].sort((a, b) => a.occupancyPct - b.occupancyPct)[0];
    const lowestClass = [...courses.byClass].sort((a, b) => a.fillRate - b.fillRate)[0];
    const data = {
      week: { from, to },
      highlights,
      lowestFacility,
      lowestClass,
      todo: { pendingClasses, classesNeedingCoach: needCoach, unmatchedBankTransactions: unmatched.count },
      quietHours: promos.map((promo) => ({ ...promo, weekday: WEEKDAYS[promo.weekday] })),
    };
    const { value, ai } = await aiParagraph(
      `${INSIGHT_SYSTEM}\nĐây là bản tóm tắt tuần ${from} đến ${to} gửi Manager vào sáng thứ 2; "change" là % so với tuần trước. Viết tối đa 5 câu, nhắc việc tồn (todo) nếu có.`,
      data,
      () =>
        [
          `Tuần ${formatCenterDateTime(from)}–${formatCenterDateTime(to)}: thực thu ${vnd(net)}${data.highlights[0]!.change === null ? '' : ` (${data.highlights[0]!.change! >= 0 ? '+' : ''}${data.highlights[0]!.change}% so với tuần trước)`}, ${bookings} lượt đặt sân, tỉ lệ lấp sân ${pct(facilities.utilizationRate)}.`,
          `${newMembers} hội viên mới, ${members.expiringSoon} gói sắp hết hạn.`,
          pendingClasses + needCoach + unmatched.count > 0
            ? `Việc tồn: ${pendingClasses} lớp chờ duyệt, ${needCoach} lớp chưa có HLV, ${unmatched.count} giao dịch chưa khớp.`
            : 'Không còn việc tồn.',
        ].join(' '),
    );
    return { from, to, text: value, ai, generatedAt: now.toISOString(), highlights, promos };
  };

  classReview = async (managerId: string, classId: string): Promise<ClassReviewInsight> => {
    const cls = await classService.get(manager(managerId), classId);
    const today = todayInCenter();
    const sessions = cls.sessions.filter(({ status }) => status === 'SCHEDULED');
    const coachIds = cls.coach ? [cls.coach.id] : [];
    const specializations = coachIds.length
      ? await specializationService.listForManager({
          page: 1,
          limit: 1,
          coachId: coachIds[0],
          sportId: cls.course.sport.id,
          status: 'APPROVED',
        })
      : null;
    const checks: ClassReviewCheck[] = [
      {
        label: 'Trạng thái',
        ok: cls.status === 'PENDING_APPROVAL',
        detail: cls.status === 'PENDING_APPROVAL' ? 'Đang chờ duyệt' : `Lớp đang ở trạng thái ${cls.status}`,
      },
      {
        label: 'Huấn luyện viên',
        ok: Boolean(cls.coach),
        detail: cls.coach ? cls.coach.fullName : 'Chưa có HLV phụ trách',
      },
      {
        label: 'Chuyên môn',
        ok: Boolean(specializations?.total),
        detail: specializations?.total
          ? `HLV đã được duyệt chuyên môn ${cls.course.sport.name}`
          : `HLV chưa có chuyên môn ${cls.course.sport.name} được duyệt`,
      },
      {
        label: 'Lịch',
        ok: !cls.scheduleConflict,
        detail: cls.scheduleConflict ? 'Lịch trùng với lượt đặt hoặc lớp khác tại sân' : 'Không trùng lịch tại sân',
      },
      {
        label: 'Ngày bắt đầu',
        ok: Boolean(cls.startDate && cls.startDate > today),
        detail: cls.startDate ? `Bắt đầu ${formatCenterDateTime(cls.startDate)}` : 'Chưa có ngày bắt đầu',
      },
      {
        label: 'Số buổi',
        ok: sessions.length === cls.course.totalSessions,
        detail: `${sessions.length}/${cls.course.totalSessions} buổi theo khóa học`,
      },
      {
        label: 'Sĩ số',
        ok: cls.minStudents >= 1 && cls.minStudents <= cls.maxStudents,
        detail: `Tối thiểu ${cls.minStudents}, tối đa ${cls.maxStudents}`,
      },
    ];
    const blocking = checks.filter(({ ok, label }) => !ok && ['Lịch', 'Ngày bắt đầu', 'Trạng thái'].includes(label));
    const recommendation: ClassReviewInsight['recommendation'] = blocking.length
      ? 'REJECT'
      : checks.every(({ ok }) => ok)
        ? 'APPROVE'
        : 'REVIEW';
    const { value, ai } = await aiParagraph(
      `Bạn giúp Manager một trung tâm thể thao duyệt lớp do HLV đề xuất. Viết 2–3 câu tiếng Việt tóm tắt lớp (môn, lịch tuần, sĩ số, HLV) và nói rõ vì sao nên "${recommendation === 'APPROVE' ? 'duyệt' : recommendation === 'REJECT' ? 'từ chối' : 'xem kỹ trước khi duyệt'}" dựa trên các mục kiểm tra. Không tự đổi kết luận.`,
      {
        name: cls.name,
        course: cls.course.name,
        sport: cls.course.sport.name,
        facility: cls.facility.name,
        weeklySchedule: cls.weeklySchedule.map((slot) => ({ ...slot, weekday: WEEKDAYS[slot.dayOfWeek] })),
        startDate: cls.startDate,
        endDate: cls.endDate,
        checks,
      },
      () =>
        `${cls.name} (${cls.course.sport.name}) tại ${cls.facility.name}, ${sessions.length} buổi, sĩ số ${cls.minStudents}–${cls.maxStudents}. ${
          recommendation === 'APPROVE'
            ? 'Mọi mục kiểm tra đều đạt, có thể duyệt.'
            : `Cần xem lại: ${checks
                .filter(({ ok }) => !ok)
                .map(({ detail }) => detail)
                .join('; ')}.`
        }`,
    );
    return { summary: value, recommendation, checks, ai };
  };

  /** Who an unmatched transfer most likely came from, by phone, name and invoices for the same amount. */
  bankSuggestions = async (transactionId: string): Promise<BankMatchCandidate[]> => {
    const row = await bankTransactionRepository.findById(transactionId);
    if (!row) throw notFound('Không tìm thấy giao dịch');
    const [codeInvoice] = row.paymentCode ? await bankTransactionRepository.findInvoicesByCodes([row.paymentCode]) : [];
    const transaction = toBankTransactionResponse(row, codeInvoice ?? null);
    const candidates = new Map<string, BankMatchCandidate>();
    const add = (account: Contact, score: number, reason: string) => {
      const candidate = candidates.get(account.id) ?? { account: contact(account), score: 0, reasons: [] };
      candidate.score = Math.min(100, candidate.score + score);
      if (!candidate.reasons.includes(reason)) candidate.reasons.push(reason);
      candidates.set(account.id, candidate);
    };

    const phones = [
      ...new Set((transaction.content.match(/(?:\+?84|0)\d{9}/g) ?? []).map((digits) => normalizePhone(digits))),
    ];
    const at = new Date(transaction.transactionDate).getTime();
    const [byPhone, byName, invoices] = await Promise.all([
      managerAiRepository.findMembersByPhones(phones),
      managerAiRepository.findMembersNamedIn(transaction.content),
      managerAiRepository.findMembersWithInvoiceOf(
        transaction.amount,
        new Date(at - 3 * DAY_MS),
        new Date(at + DAY_MS),
      ),
    ]);
    for (const account of byPhone) add(account, 60, 'Số điện thoại có trong nội dung chuyển khoản');
    for (const account of byName) add(account, 40, 'Tên hội viên có trong nội dung chuyển khoản');
    for (const invoice of invoices) {
      if (invoice.account) {
        add(
          invoice.account.account,
          invoice.status === 'PENDING' || invoice.status === 'EXPIRED' ? 35 : 15,
          `Có hóa đơn ${invoice.paymentCode} cùng số tiền ${vnd(transaction.amount)}`,
        );
      }
    }
    const codeOwner = transaction.codeInvoice?.account;
    if (codeOwner) {
      add(
        { id: codeOwner.id, fullName: codeOwner.fullName, phone: codeOwner.phone, email: null },
        50,
        'Mã thanh toán trong nội dung thuộc hóa đơn của hội viên này',
      );
    }
    return [...candidates.values()].sort((a, b) => b.score - a.score).slice(0, 5);
  };

  /** Coaches for a class without one: who registered, who holds the sport, who is free at those hours. */
  coachSuggestions = async (managerId: string, classId: string) => {
    const cls = await classService.get(manager(managerId), classId);
    const registrations = (cls.coachRegistrations ?? []).filter(({ status }) => status === 'PENDING');
    const specialists = await specializationService.listForManager({
      page: 1,
      limit: 20,
      sportId: cls.course.sport.id,
      status: 'APPROVED',
    });
    const coaches = new Map<
      string,
      { coach: { id: string; fullName: string }; registrationId: string | null; score: number; reasons: string[] }
    >();
    for (const registration of registrations) {
      coaches.set(registration.coach.id, {
        coach: registration.coach,
        registrationId: registration.id,
        score: 50,
        reasons: ['Đã đăng ký dạy lớp này'],
      });
    }
    for (const { coach, experienceYears } of specialists.items) {
      const row = coaches.get(coach.id) ?? { coach, registrationId: null, score: 0, reasons: [] };
      row.score += 30;
      row.reasons.push(
        `Chuyên môn ${cls.course.sport.name} đã duyệt${experienceYears ? `, ${experienceYears} năm kinh nghiệm` : ''}`,
      );
      coaches.set(coach.id, row);
    }
    const rows = await Promise.all(
      [...coaches.values()].map(async (row) => {
        const page = await classService.list(manager(managerId), {
          page: 1,
          limit: 50,
          coachId: row.coach.id,
          status: 'OPEN',
        });
        const active = page.items.filter((other) => other.id !== cls.id && other.derivedStatus !== 'COMPLETED');
        const clash = active.find(
          (other) =>
            datesOverlap(other, cls) &&
            other.weeklySchedule.some((slot) => cls.weeklySchedule.some((mine) => weeklyMatch(slot, mine))),
        );
        if (clash)
          return { ...row, score: 0, reasons: [...row.reasons, `Trùng giờ với lớp ${clash.name}`], available: false };
        row.score += Math.max(0, 20 - active.length * 5);
        row.reasons.push(active.length ? `Đang dạy ${active.length} lớp` : 'Chưa dạy lớp nào');
        return { ...row, available: true, activeClasses: active.length };
      }),
    );
    return {
      class: { id: cls.id, name: cls.name, sport: cls.course.sport.name, hasCoach: Boolean(cls.coach) },
      candidates: rows.sort((a, b) => b.score - a.score).slice(0, 5),
    };
  };

  private maintenanceOf = async (id: string) => {
    const row = await maintenanceRepository.findById(id);
    if (!row) throw notFound('Không tìm thấy lịch bảo trì');
    return { ...toMaintenanceResponse(row), facilityId: row.facilityId };
  };

  private recipientsOf = (maintenance: { facilityId: string; endAt: string }) => {
    const today = todayInCenter();
    const end = formatDate(new Date(maintenance.endAt));
    return managerAiRepository.findFacilityUsers(
      maintenance.facilityId,
      new Date(addDays(today, -30)),
      new Date(end > today ? end : today),
    );
  };

  maintenanceNotice = async (id: string): Promise<MaintenanceNoticeDraft> => {
    const maintenance = await this.maintenanceOf(id);
    const recipients = await this.recipientsOf(maintenance);
    const period = `${formatCenterDateTime(maintenance.startAt)} đến ${formatCenterDateTime(maintenance.endAt)}`;
    const fallback = {
      title: `Bảo trì ${maintenance.facility.name}`,
      message: `${maintenance.facility.name} sẽ tạm ngưng để bảo trì từ ${period} (${maintenance.reason}). Lượt đặt và buổi học bị ảnh hưởng đã được chuyển sân hoặc dời lịch; bạn xem chi tiết trong lịch của mình. Xin lỗi vì sự bất tiện.`,
    };
    const { value, ai } = await aiJson(
      {
        system: `Bạn soạn thông báo gửi hội viên của một trung tâm thể thao ở Việt Nam về việc bảo trì sân. Giọng lịch sự, ngắn gọn (tối đa 4 câu), nêu tên sân, thời gian, lý do và nhắc hội viên xem lịch của mình; không hứa bồi thường. ${GUARD}`,
        prompt: asData({
          facility: maintenance.facility.name,
          from: formatCenterDateTime(maintenance.startAt),
          to: formatCenterDateTime(maintenance.endAt),
          reason: maintenance.reason,
        }),
        schema: {
          type: 'OBJECT',
          properties: { title: { type: 'STRING' }, message: { type: 'STRING' } },
          required: ['title', 'message'],
        },
      },
      (raw) => {
        const draft = raw as { title?: unknown; message?: unknown } | null;
        return typeof draft?.title === 'string' && typeof draft.message === 'string' && draft.title && draft.message
          ? { title: draft.title.slice(0, 255), message: draft.message.slice(0, 2000) }
          : null;
      },
      () => fallback,
    );
    return { ...value, recipients: recipients.length, ai };
  };

  announceMaintenance = async (id: string, { title, message }: MaintenanceAnnounceBody) => {
    const maintenance = await this.maintenanceOf(id);
    const recipients = await this.recipientsOf(maintenance);
    const inputs: NotificationInput[] = recipients.map((accountId) => ({
      accountId,
      type: 'SYSTEM',
      title,
      message,
      referenceType: 'MAINTENANCE',
      referenceId: id,
      dedupKey: `maintenance-notice:${id}:${accountId}`,
      sendEmail: true,
    }));
    const created = inputs.length ? await notificationService.create(inputs) : [];
    notificationService.sendEmailsAfterCommit(created);
    return { sent: created.length };
  };

  supportTriage = async (
    viewer: { id: string; role: 'MANAGER' | 'RECEPTIONIST' },
    id: string,
  ): Promise<SupportTriage> => {
    const request = await supportService.get(viewer, id);
    const urgent = /hoàn|tiền|thanh toán|trừ|mất|lỗi|khóa|không vào được|chuyển khoản/i.test(
      `${request.subject} ${request.description}`,
    );
    const fallback = {
      category: request.category,
      priority: (urgent ? 'HIGH' : 'MEDIUM') as SupportPriority,
      summary: request.subject,
      reply: `Chào ${request.account.fullName}, trung tâm đã nhận yêu cầu "${request.subject}" của bạn và đang kiểm tra. Chúng tôi sẽ phản hồi sớm nhất có thể. Cảm ơn bạn đã kiên nhẫn.`,
    };
    const { value, ai } = await aiJson(
      {
        system: `Bạn hỗ trợ nhân viên một trung tâm thể thao ở Việt Nam xử lý yêu cầu hỗ trợ của hội viên.
Phân loại yêu cầu (category), đánh giá mức ưu tiên (priority: HIGH khi liên quan tiền, không dùng được dịch vụ hoặc tài khoản; LOW khi chỉ hỏi thông tin), tóm tắt 1 câu (summary) và soạn nháp phản hồi lịch sự 2–4 câu (reply) gửi hội viên, xưng "trung tâm", không hứa hoàn tiền hay bồi thường cụ thể. ${GUARD}`,
        prompt: asData({
          subject: request.subject,
          description: request.description,
          category: request.category,
          member: request.account.fullName,
        }),
        schema: {
          type: 'OBJECT',
          properties: {
            category: { type: 'STRING', enum: [...SUPPORT_CATEGORIES] },
            priority: { type: 'STRING', enum: [...SUPPORT_PRIORITIES] },
            summary: { type: 'STRING' },
            reply: { type: 'STRING' },
          },
          required: ['category', 'priority', 'summary', 'reply'],
        },
        temperature: 0.3,
      },
      (raw) => {
        const r = raw as Partial<Record<'category' | 'priority' | 'summary' | 'reply', unknown>> | null;
        if (
          !r ||
          !SUPPORT_CATEGORIES.includes(r.category as SupportCategory) ||
          !SUPPORT_PRIORITIES.includes(r.priority as SupportPriority) ||
          typeof r.summary !== 'string' ||
          typeof r.reply !== 'string'
        )
          return null;
        return {
          category: r.category as SupportCategory,
          priority: r.priority as SupportPriority,
          summary: r.summary.slice(0, 500),
          reply: r.reply.slice(0, 5000),
        };
      },
      () => fallback,
    );
    return { ...value, ai };
  };
}

export default new ManagerInsightsService();
