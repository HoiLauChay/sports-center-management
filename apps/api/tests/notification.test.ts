import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';

import { prisma } from '~/configs/db';
import mailService from '~/services/mail.service';
import notificationService from '~/services/notification.service';
import { resetDatabase } from './helpers/db';

let accountId: string;

beforeEach(async () => {
  await resetDatabase();
  const account = await prisma.account.create({
    data: { email: 'member@example.com', passwordHash: 'hash', fullName: 'Member', memberProfile: { create: {} } },
  });
  accountId = account.id;
});

afterEach(() => {
  mock.restore();
});

describe('notificationService.create', () => {
  test('creates one notification per dedup key', async () => {
    const input = { accountId, type: 'SYSTEM' as const, title: 'Hi', message: 'Hello', dedupKey: 'welcome:1' };

    const first = await notificationService.create([input]);
    const second = await notificationService.create([input]);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
    expect(await prisma.notification.count()).toBe(1);
  });
});

describe('notificationService.resendPendingEmails', () => {
  test('retries old unsent emails and marks them sent only on success', async () => {
    const old = new Date(Date.now() - 60 * 60 * 1000);
    await prisma.notification.createMany({
      data: [
        { accountId, type: 'SYSTEM', title: 'A', message: 'a', sendEmail: true, createdAt: old },
        { accountId, type: 'SYSTEM', title: 'B', message: 'b', sendEmail: true, createdAt: old },
        { accountId, type: 'SYSTEM', title: 'C', message: 'c', sendEmail: true },
        { accountId, type: 'SYSTEM', title: 'D', message: 'd', createdAt: old },
      ],
    });
    const sendBatch = spyOn(mailService, 'sendBatch').mockRejectedValueOnce(new Error('resend down'));

    expect(await notificationService.resendPendingEmails()).toEqual({ sent: 0, failed: 2 });
    expect(await prisma.notification.count({ where: { emailSentAt: { not: null } } })).toBe(0);

    sendBatch.mockResolvedValueOnce(undefined);
    expect(await notificationService.resendPendingEmails()).toEqual({ sent: 2, failed: 0 });

    const sent = await prisma.notification.findMany({
      where: { emailSentAt: { not: null } },
      orderBy: { title: 'asc' },
    });
    expect(sent.map(({ title }) => title)).toEqual(['A', 'B']);
  });
});
