import {
  AUTOMATION_KEYS,
  AUTOMATIONS,
  ERROR_CODE,
  type AutomationKey,
  type AutomationSetting,
  type UpdateAutomationBody,
} from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import managerAiRepository from '~/repositories/managerAi.repository';
import { ErrorWithStatus } from '~/rules/error';
import { vnd } from '~/services/ai/aiText';
import managerInsightsService from '~/services/ai/managerInsights.service';
import { WEEKDAYS } from '~/services/ai/tools/toolkit';
import notificationService, { type NotificationInput } from '~/services/notification.service';
import { addDays, formatCenterDate, formatDate, formatTime, fromDbTime, todayInCenter } from '~/utils/time';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

type Settings = Record<AutomationKey, { enabled: boolean; threshold: number | null }>;

const thresholdOf = (key: AutomationKey, stored: number | null | undefined) =>
  AUTOMATIONS[key].threshold ? (stored ?? AUTOMATIONS[key].threshold.default) : null;

/** ISO-like week id of the Monday a date falls in, for "once a week" dedup keys. */
const weekOf = (date: string) => addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));

const invalid = (message: string) =>
  new ErrorWithStatus({
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    code: ERROR_CODE.VALIDATION,
    message: 'Dữ liệu không hợp lệ',
    errors: [{ path: 'body.threshold', message }],
  });

/** One notification per recipient; the dedup key makes every job safe to run again. */
const toEach = (accountIds: string[], dedup: string, input: Omit<NotificationInput, 'accountId' | 'dedupKey'>) =>
  accountIds.map((accountId): NotificationInput => ({
    ...input,
    accountId,
    dedupKey: `${dedup}:${accountId}`.slice(0, 150),
  }));

class AutomationService {
  list = async (): Promise<AutomationSetting[]> => {
    const rows = new Map((await managerAiRepository.findAutomationSettings()).map((row) => [row.key, row]));
    return AUTOMATION_KEYS.map((key) => {
      const row = rows.get(key);
      return {
        key,
        enabled: row?.enabled ?? true,
        threshold: thresholdOf(key, row?.threshold),
        lastRunAt: row?.lastRunAt?.toISOString() ?? null,
        updatedAt: row ? row.updatedAt.toISOString() : null,
      };
    });
  };

  update = async (managerId: string, key: AutomationKey, { enabled, threshold }: UpdateAutomationBody) => {
    const limits = AUTOMATIONS[key].threshold;
    if (threshold !== undefined) {
      if (!limits) throw invalid('Tự động hóa này không có ngưỡng để chỉnh');
      if (threshold < limits.min || threshold > limits.max)
        throw invalid(`Ngưỡng phải từ ${limits.min} đến ${limits.max} ${limits.unit}`);
    }
    await managerAiRepository.upsertAutomationSetting(key, { enabled, threshold, updatedById: managerId });
    return (await this.list()).find((row) => row.key === key)!;
  };

  private settings = async (): Promise<Settings> =>
    Object.fromEntries(
      (await this.list()).map(({ key, enabled, threshold }) => [key, { enabled, threshold }]),
    ) as Settings;

  /**
   * Runs every enabled automation. Safe to call as often as the scheduler likes (hourly is plenty): weekly
   * jobs dedupe on the week, daily ones on the day, per-item ones on the item.
   */
  run = async (now = new Date()) => {
    const settings = await this.settings();
    const today = todayInCenter(now);
    const managers = await managerAiRepository.findAccountIds('MANAGER');
    const jobs: Record<AutomationKey, () => Promise<NotificationInput[]>> = {
      WEEKLY_DIGEST: () => this.digest(managers, today, now, settings.PROMO_SUGGESTION.threshold ?? 30),
      PROMO_SUGGESTION: () => this.promos(managers, today, now, settings.PROMO_SUGGESTION.threshold!),
      UNDERFILLED_CLASS: () => this.underfilled(managers, today, settings.UNDERFILLED_CLASS.threshold!),
      UNMATCHED_BANK: () => this.unmatched(managers, today, now, settings.UNMATCHED_BANK.threshold!),
      OVERDUE_SUPPORT: () => this.overdueSupport(managers, now, settings.OVERDUE_SUPPORT.threshold!),
      INACTIVE_MEMBERS: () => this.inactive(managers, today, now, settings.INACTIVE_MEMBERS.threshold!),
    };

    const result: Partial<Record<AutomationKey, number | 'off' | 'failed'>> = {};
    for (const key of AUTOMATION_KEYS) {
      if (!settings[key].enabled) {
        result[key] = 'off';
        continue;
      }
      try {
        const inputs = await jobs[key]();
        const created = inputs.length ? await notificationService.create(inputs) : [];
        notificationService.sendEmailsAfterCommit(created);
        await managerAiRepository.upsertAutomationSetting(key, { lastRunAt: now });
        result[key] = created.length;
      } catch (err) {
        console.error(`Automation ${key} failed:`, err);
        result[key] = 'failed';
      }
    }
    return result;
  };

  /** Monday only: last week's digest, written once (cached) and sent to every manager by email too. */
  private digest = async (managers: string[], today: string, now: Date, promoThreshold: number) => {
    if (new Date(`${today}T00:00:00Z`).getUTCDay() !== 1) return [];
    const digest = await managerInsightsService.weeklyDigest(now, promoThreshold);
    return toEach(managers, `digest:${digest.from}`, {
      type: 'SYSTEM',
      title: `Tóm tắt tuần ${formatCenterDate(digest.from)}–${formatCenterDate(digest.to)}`,
      message: digest.text,
      referenceType: 'DIGEST',
      referenceId: null,
      sendEmail: true,
    });
  };

  /** Monday only: quiet facility hours worth a discount code this week. */
  private promos = async (managers: string[], today: string, now: Date, threshold: number) => {
    if (new Date(`${today}T00:00:00Z`).getUTCDay() !== 1) return [];
    const promos = await managerInsightsService.promoSuggestions(threshold, now);
    if (!promos.length) return [];
    const lines = promos.map(
      (promo) =>
        `${promo.facility.name} ${WEEKDAYS[promo.weekday]} ${promo.startTime}–${promo.endTime} (lấp ${promo.occupancyPct}%, gợi ý giảm ${promo.discountPct}%)`,
    );
    return toEach(managers, `promo:${weekOf(today)}`, {
      type: 'SYSTEM',
      title: 'Gợi ý khuyến mãi giờ vắng',
      message: `Khung giờ vắng 4 tuần qua: ${lines.join('; ')}. Hỏi Trợ lý AI "tạo mã giảm giá giờ vắng" để soạn sẵn mã.`,
      referenceType: 'PROMO',
      referenceId: null,
      sendEmail: false,
    });
  };

  /** Classes still short of students `days` days before their first session (the system cancels them 24h before). */
  private underfilled = async (managers: string[], today: string, days: number) => {
    const classes = await managerAiRepository.findClassesStartingBetween(
      new Date(addDays(today, 1)),
      new Date(addDays(today, days)),
    );
    return classes
      .filter((cls) => cls._count.enrollments < cls.minStudents && cls.sessions[0])
      .flatMap((cls) => {
        const first = cls.sessions[0]!;
        return toEach(managers, `underfilled:${cls.id}`, {
          type: 'CLASS',
          title: 'Lớp sắp bị hủy vì thiếu học viên',
          message: `${cls.name} (${cls.course.sport.name}) mới có ${cls._count.enrollments}/${cls.minStudents} học viên tối thiểu, buổi đầu ${formatCenterDate(formatDate(first.sessionDate))} lúc ${formatTime(fromDbTime(first.startTime))}. Lớp sẽ tự hủy 24 giờ trước buổi đầu nếu vẫn thiếu.`,
          referenceType: 'CLASS',
          referenceId: cls.id,
          sendEmail: false,
        });
      });
  };

  private unmatched = async (managers: string[], today: string, now: Date, hours: number) => {
    const stale = await managerAiRepository.findStaleUnmatched(new Date(now.getTime() - hours * HOUR_MS));
    if (!stale.count) return [];
    return toEach(managers, `unmatched:${today}`, {
      type: 'PAYMENT',
      title: 'Giao dịch ngân hàng chưa khớp',
      message: `${stale.count} chuyển khoản (${vnd(stale.amount)}) chưa khớp với hội viên nào quá ${hours} giờ. Mở trang Giao dịch ngân hàng để xem gợi ý khớp.`,
      referenceType: 'BANK_TRANSACTION',
      referenceId: null,
      sendEmail: false,
    });
  };

  /** Each overdue request alerts reception and managers once. */
  private overdueSupport = async (managers: string[], now: Date, hours: number) => {
    const overdue = await managerAiRepository.findOverdueSupport(new Date(now.getTime() - hours * HOUR_MS));
    if (!overdue.count) return [];
    const staff = [...new Set([...managers, ...(await managerAiRepository.findAccountIds('RECEPTIONIST'))])];
    return overdue.latest.flatMap((request) =>
      toEach(staff, `support-overdue:${request.id}`, {
        type: 'SUPPORT',
        title: 'Yêu cầu hỗ trợ quá hạn',
        message: `"${request.subject}" đang chờ từ ${formatCenterDate(request.createdAt)} (hơn ${hours} giờ)${overdue.count > overdue.latest.length ? `; tổng cộng ${overdue.count} yêu cầu quá hạn` : ''}.`,
        referenceType: 'SUPPORT_REQUEST',
        referenceId: request.id,
        sendEmail: false,
      }),
    );
  };

  /** Monday only: how many members went quiet, so the manager can decide on a win-back campaign. */
  private inactive = async (managers: string[], today: string, now: Date, days: number) => {
    if (new Date(`${today}T00:00:00Z`).getUTCDay() !== 1) return [];
    const { count, sample } = await managerAiRepository.findInactiveMembers(new Date(now.getTime() - days * DAY_MS));
    if (!count) return [];
    return toEach(managers, `inactive:${weekOf(today)}`, {
      type: 'MEMBERSHIP',
      title: 'Hội viên lâu không quay lại',
      message: `${count} hội viên không đặt sân, không đi học và không check-in ${days} ngày qua, ví dụ: ${sample
        .slice(0, 5)
        .map(({ fullName }) => fullName)
        .join(', ')}.`,
      referenceType: null,
      referenceId: null,
      sendEmail: false,
    });
  };
}

export default new AutomationService();
