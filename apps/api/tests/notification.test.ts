import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';

import { prisma } from '~/configs/db';
import type { ErrorWithStatus } from '~/rules/error';
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

    expect(await notificationService.resendPendingEmails()).toEqual({ processed: 0, remaining: 0 });
    expect(await prisma.notification.count({ where: { emailSentAt: { not: null } } })).toBe(0);

    sendBatch.mockResolvedValueOnce(undefined);
    expect(await notificationService.resendPendingEmails()).toEqual({ processed: 2, remaining: 0 });

    const sent = await prisma.notification.findMany({
      where: { emailSentAt: { not: null } },
      orderBy: { title: 'asc' },
    });
    expect(sent.map(({ title }) => title)).toEqual(['A', 'B']);
  });
});

describe('notification inbox', () => {
  let otherId: string;
  const at = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000);

  beforeEach(async () => {
    const other = await prisma.account.create({
      data: { email: 'other@example.com', passwordHash: 'hash', fullName: 'Other', memberProfile: { create: {} } },
    });
    otherId = other.id;
    await prisma.notification.createMany({
      data: [
        { accountId, type: 'SYSTEM', title: 'A', message: 'a', createdAt: at(3) },
        { accountId, type: 'SYSTEM', title: 'B', message: 'b', createdAt: at(2), readAt: at(1) },
        { accountId, type: 'SYSTEM', title: 'C', message: 'c', createdAt: at(1) },
        { accountId: otherId, type: 'SYSTEM', title: 'X', message: 'x' },
      ],
    });
  });

  test('pages only own notifications with the unread count', async () => {
    const first = await notificationService.list(accountId, { limit: 2 });
    expect(first.items.map(({ title }) => title)).toEqual(['C', 'B']);
    expect(first.unreadCount).toBe(2);

    const second = await notificationService.list(accountId, { limit: 2, cursor: first.nextCursor! });
    expect(second.items.map(({ title }) => title)).toEqual(['A']);
    expect(second.nextCursor).toBeNull();

    const unread = await notificationService.list(accountId, { limit: 20, unreadOnly: true });
    expect(unread.items.map(({ title }) => title)).toEqual(['C', 'A']);
  });

  test('cannot mark notifications of another account', async () => {
    const foreign = await prisma.notification.findFirstOrThrow({ where: { accountId: otherId } });
    const error = await notificationService.markRead(accountId, foreign.id).catch((err: unknown) => err);
    expect((error as ErrorWithStatus).status).toBe(404);

    const own = await prisma.notification.findFirstOrThrow({ where: { accountId, title: 'C' } });
    await notificationService.markRead(accountId, own.id);
    await notificationService.markRead(accountId, own.id);
    expect((await notificationService.list(accountId, { limit: 20 })).unreadCount).toBe(1);

    await notificationService.markAllRead(accountId);
    expect(await prisma.notification.count({ where: { accountId, readAt: null } })).toBe(0);
    expect(await prisma.notification.count({ where: { accountId: otherId, readAt: null } })).toBe(1);
  });
});
