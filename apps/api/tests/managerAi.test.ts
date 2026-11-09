import type {
  AssistantReply,
  AutomationSetting,
  BankMatchSuggestions,
  ClassReviewInsight,
  ManagerAssistantOverview,
  SupportTriage,
} from '@sports-center/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import geminiClient, { type ChatInput, type ChatTurn } from '~/services/ai/gemini.client';
import automationService from '~/services/automation.service';
import { toDbTime, todayInCenter } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { createAccount, readCode, readResult, startServer } from './helpers/http';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];
let assistant: Awaited<ReturnType<typeof startServer>>['request'];
let generateJson: ReturnType<typeof spyOn<typeof geminiClient, 'generateJson'>>;
let chat: ReturnType<typeof spyOn<typeof geminiClient, 'chat'>>;
let assistantServer: Server;

const HOUR = 3_600_000;
const day = (offset: number) => new Date(Date.parse(todayInCenter()) + offset * 86_400_000);
const turn = (calls: ChatTurn['calls'] = [], text = ''): ChatTurn => ({
  content: {
    role: 'model',
    parts: calls.length ? calls.map(({ name, args }) => ({ functionCall: { name, args } })) : [{ text }],
  },
  text,
  calls,
});

beforeAll(async () => {
  ({ server, request } = await startServer('/ai'));
  ({ server: assistantServer, request: assistant } = await startServer('/assistant'));
});
afterAll(() => {
  server.close();
  assistantServer.close();
});
beforeEach(async () => {
  await resetDatabase();
  generateJson = spyOn(geminiClient, 'generateJson');
  chat = spyOn(geminiClient, 'chat');
});
afterEach(() => {
  generateJson.mockRestore();
  chat.mockRestore();
});

const setupClass = async () => {
  const manager = await createAccount('MANAGER', 'manager@example.com');
  const coach = await createAccount('COACH', 'coach@example.com', { fullName: 'Trần Huấn Luyện' });
  const sport = await prisma.sport.create({ data: { name: 'Boxing' } });
  await prisma.coachSpecialization.create({ data: { coachId: coach.id, sportId: sport.id, status: 'APPROVED' } });
  const course = await prisma.course.create({
    data: { name: 'Boxing cơ bản', sportId: sport.id, price: 100_000, totalSessions: 1 },
  });
  const room = await prisma.facility.create({
    data: { name: 'Phòng 1', type: 'ROOM', capacityPerSlot: 1, pricePerSlot: 0 },
  });
  const cls = await prisma.class.create({
    data: {
      courseId: course.id,
      facilityId: room.id,
      coachId: coach.id,
      name: 'Boxing tối',
      weeklySchedule: [],
      minStudents: 2,
      maxStudents: 10,
      startDate: day(3),
      endDate: day(3),
      status: 'PENDING_APPROVAL',
      sessions: {
        create: {
          facilityId: room.id,
          sessionNumber: 1,
          sessionDate: day(3),
          startTime: toDbTime(18 * 60),
          endTime: toDbTime(19 * 60),
        },
      },
    },
  });
  return { manager, coach, sport, course, room, cls };
};

describe('manager AI endpoints', () => {
  test('only managers reach them; support triage is open to reception too', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'reception@example.com');
    const support = await prisma.supportRequest.create({
      data: { accountId: member.id, subject: 'Hỏi giờ mở cửa', description: 'Mấy giờ mở cửa?' },
    });
    generateJson.mockRejectedValue(new Error('AI down'));

    expect((await request('GET', '/automations', member)).status).toBe(403);
    expect((await request('GET', '/automations', receptionist)).status).toBe(403);
    const triage = await request('POST', `/support/${support.id}/triage`, receptionist);
    expect(triage.status).toBe(200);
    expect((await request('POST', `/support/${support.id}/triage`, member)).status).toBe(403);
  });

  test('class review checks the class by rules and keeps the AI summary to the verdict', async () => {
    const { manager, cls } = await setupClass();
    generateJson.mockResolvedValueOnce({ text: 'Lớp Boxing tối đạt mọi mục, nên duyệt.' });

    const review = await readResult<ClassReviewInsight>(await request('POST', `/classes/${cls.id}/review`, manager));
    expect(review).toMatchObject({
      recommendation: 'APPROVE',
      ai: true,
      summary: 'Lớp Boxing tối đạt mọi mục, nên duyệt.',
    });
    expect(review.checks.every(({ ok }) => ok)).toBe(true);
    const { prompt } = generateJson.mock.calls[0]![0];
    expect(prompt).toStartWith('<du_lieu>');
  });

  test('a class without a coach is not recommended, and AI failure falls back to the template', async () => {
    const { manager, cls } = await setupClass();
    await prisma.class.update({ where: { id: cls.id }, data: { coachId: null } });
    generateJson.mockRejectedValueOnce(new Error('AI down'));

    const review = await readResult<ClassReviewInsight>(await request('POST', `/classes/${cls.id}/review`, manager));
    expect(review.recommendation).toBe('REVIEW');
    expect(review.ai).toBe(false);
    expect(review.summary).toContain('Chưa có HLV');
  });

  test('bank suggestions rank the member whose phone is in the transfer first', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const payer = await createAccount('MEMBER', 'payer@example.com', {
      fullName: 'Lê Văn Chuyển',
      phone: '0912345678',
    });
    await createAccount('MEMBER', 'other@example.com', { fullName: 'Người Khác', phone: '0987654321' });
    const transaction = await prisma.bankTransaction.create({
      data: {
        bankName: 'MBBank',
        accountNumber: '0001',
        amount: 200_000,
        content: 'LE VAN CHUYEN 0912345678 nap vi',
        referenceCode: 'REF-1',
        transactionDate: new Date(),
        status: 'UNMATCHED',
        rawPayload: {},
      },
    });

    const { candidates } = await readResult<BankMatchSuggestions>(
      await request('GET', `/bank-transactions/${transaction.id}/suggestions`, manager),
    );
    expect(candidates[0]).toMatchObject({ account: { id: payer.id } });
    expect(candidates[0]!.reasons).toEqual(
      expect.arrayContaining([
        'Số điện thoại có trong nội dung chuyển khoản',
        'Tên hội viên có trong nội dung chuyển khoản',
      ]),
    );
    expect(candidates.map(({ account }) => account.fullName)).not.toContain('Người Khác');
  });

  test('support triage keeps only valid AI fields and drafts a reply', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const member = await createAccount('MEMBER', 'member@example.com', { fullName: 'Hội Viên A' });
    const support = await prisma.supportRequest.create({
      data: { accountId: member.id, subject: 'Bị trừ tiền 2 lần', description: 'Ví bị trừ hai lần khi đặt sân' },
    });
    generateJson.mockResolvedValueOnce({ category: 'NOT_A_CATEGORY', priority: 'HIGH', summary: 'x', reply: 'y' });

    const triage = await readResult<SupportTriage>(await request('POST', `/support/${support.id}/triage`, manager));
    expect(triage).toMatchObject({ ai: false, priority: 'HIGH', category: 'OTHER' });
    expect(triage.reply).toContain('Hội Viên A');
  });

  test('automation thresholds are validated and saved', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const tooHigh = await request('PATCH', '/automations/OVERDUE_SUPPORT', manager, { threshold: 999 });
    expect([tooHigh.status, await readCode(tooHigh)]).toEqual([422, 'VALIDATION_ERROR']);
    const noThreshold = await request('PATCH', '/automations/WEEKLY_DIGEST', manager, { threshold: 5 });
    expect(noThreshold.status).toBe(422);

    const saved = await readResult<AutomationSetting>(
      await request('PATCH', '/automations/OVERDUE_SUPPORT', manager, { threshold: 12, enabled: false }),
    );
    expect(saved).toMatchObject({ key: 'OVERDUE_SUPPORT', threshold: 12, enabled: false });
    const all = await readResult<AutomationSetting[]>(await request('GET', '/automations', manager));
    expect(all.find(({ key }) => key === 'UNMATCHED_BANK')).toMatchObject({ enabled: true, threshold: 24 });
  });
});

describe('automation run', () => {
  test('an overdue support request alerts managers and reception once, and a switched-off job does nothing', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'reception@example.com');
    const member = await createAccount('MEMBER', 'member@example.com');
    await prisma.supportRequest.create({
      data: {
        accountId: member.id,
        subject: 'Chưa ai trả lời',
        description: '...',
        createdAt: new Date(Date.now() - 30 * HOUR),
      },
    });
    await prisma.supportRequest.create({ data: { accountId: member.id, subject: 'Mới gửi', description: '...' } });

    const first = await automationService.run();
    expect(first.OVERDUE_SUPPORT).toBe(2);
    const alerts = await prisma.notification.findMany({ where: { type: 'SUPPORT' } });
    expect(alerts.map(({ accountId }) => accountId).sort()).toEqual([manager.id, receptionist.id].sort());
    expect(alerts[0]!.message).toContain('Chưa ai trả lời');

    expect((await automationService.run()).OVERDUE_SUPPORT).toBe(0);

    await automationService.update(manager.id, 'OVERDUE_SUPPORT', { enabled: false });
    expect((await automationService.run()).OVERDUE_SUPPORT).toBe('off');
  });
});

describe('manager assistant', () => {
  test('the manager gets report tools and an overview; a member gets neither', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const member = await createAccount('MEMBER', 'member@example.com');
    chat
      .mockResolvedValueOnce(turn([{ name: 'manager_todo', args: {} }]))
      .mockResolvedValueOnce(turn([], 'Không có việc tồn.'));

    const reply = await readResult<AssistantReply>(
      await assistant('POST', '/chat', manager, { messages: [{ role: 'user', text: 'Tôi có việc gì?' }] }),
    );
    expect(reply).toMatchObject({ reply: 'Không có việc tồn.', sources: ['Việc đang chờ'], quota: null });
    const { tools, system } = chat.mock.calls[0]![0] as ChatInput;
    expect(tools.map(({ name }) => name)).toEqual(expect.arrayContaining(['revenue_report', 'propose_bank_match']));
    expect(system).toContain('Manager');

    const overview = await readResult<ManagerAssistantOverview>(await assistant('GET', '/overview', manager));
    expect(overview).toMatchObject({ role: 'MANAGER', pendingClasses: 0, unmatchedBankTransactions: 0 });

    chat.mockResolvedValueOnce(turn([], 'Chào bạn.'));
    await assistant('POST', '/chat', member, { messages: [{ role: 'user', text: 'Chào' }] });
    const memberTools = (chat.mock.calls.at(-1)![0] as ChatInput).tools.map(({ name }) => name);
    expect(memberTools).not.toContain('revenue_report');
  });

  test('propose_class_review prepares a card and refuses a rejection without a reason', async () => {
    const { manager, cls } = await setupClass();
    chat
      .mockResolvedValueOnce(
        turn([
          { name: 'propose_class_review', args: { classId: cls.id, decision: 'REJECT' } },
          { name: 'propose_class_review', args: { classId: cls.id, decision: 'APPROVE' } },
        ]),
      )
      .mockResolvedValueOnce(turn([], 'Bạn kiểm tra thẻ bên dưới.'));

    const reply = await readResult<AssistantReply>(
      await assistant('POST', '/chat', manager, { messages: [{ role: 'user', text: 'Duyệt lớp Boxing tối' }] }),
    );
    expect(reply.actions).toEqual([
      { type: 'CLASS_REVIEW', classId: cls.id, title: 'Boxing tối · Boxing', decision: 'APPROVE', note: null },
    ]);
    expect((await prisma.class.findUniqueOrThrow({ where: { id: cls.id } })).status).toBe('PENDING_APPROVAL');
  });
});
