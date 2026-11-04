import { beforeEach, describe, expect, test } from 'bun:test';

import { AssistantMemory, itemsFrom, type MemoryItem, type MemoryStore } from '~/services/ai/memory';

const FACILITY = '11111111-1111-4111-8111-111111111111';
const CLASS = '22222222-2222-4222-8222-222222222222';
const facility: MemoryItem = { type: 'FACILITY', id: FACILITY, label: 'Sân A' };

const fakeStore = () => {
  const hashes = new Map<string, Record<string, unknown>>();
  const ttl = new Map<string, number>();
  const store: MemoryStore = {
    hget: async (key, field) => hashes.get(key)?.[field] ?? null,
    hset: async (key, values) => hashes.set(key, { ...hashes.get(key), ...values }),
    expire: async (key, seconds) => ttl.set(key, seconds),
    hdel: async (key, field) => delete hashes.get(key)?.[field],
    del: async (key) => hashes.delete(key),
  };
  return { store, hashes, ttl };
};

describe('assistant memory', () => {
  let fake: ReturnType<typeof fakeStore>;
  let memory: AssistantMemory;

  beforeEach(() => {
    fake = fakeStore();
    memory = new AssistantMemory(fake.store);
  });

  test('remembers for half an hour, per account', async () => {
    await memory.remember('a', 'chat', 'MEMBER', [], [facility]);

    expect(await memory.recall('a', 'chat', 'MEMBER')).toEqual([facility]);
    expect(fake.ttl.get('assistant:ctx:a')).toBe(1800);
    expect(await memory.recall('b', 'chat', 'MEMBER')).toEqual([]);
    expect(await memory.recall('a', 'other', 'MEMBER')).toEqual([]);
  });

  test('a changed role starts empty', async () => {
    await memory.remember('a', 'chat', 'COACH', [], [facility]);
    expect(await memory.recall('a', 'chat', 'MEMBER')).toEqual([]);
  });

  test('a damaged value is ignored', async () => {
    await fake.store.hset('assistant:ctx:a', { chat: { role: 'MEMBER', items: [{ id: 'x', secret: 1 }] } });
    expect(await memory.recall('a', 'chat', 'MEMBER')).toEqual([]);
  });

  test('keeps the newest twenty', async () => {
    const items = Array.from({ length: 25 }, (_, i) => ({
      ...facility,
      id: `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`,
    }));
    await memory.remember('a', 'chat', 'MEMBER', [], items);

    const kept = await memory.recall('a', 'chat', 'MEMBER');
    expect(kept).toHaveLength(20);
    expect(kept.at(-1)).toEqual(items.at(-1)!);
  });

  test('a store that fails or hangs never stops the chat', async () => {
    const broken = new AssistantMemory({
      ...fake.store,
      hget: () => Promise.reject(new Error('down')),
      hset: () => new Promise(() => undefined),
    });
    expect(await broken.recall('a', 'chat', 'MEMBER')).toEqual([]);
    await broken.remember('a', 'chat', 'MEMBER', [], [facility]);
  });

  test('works without Redis', async () => {
    const off = new AssistantMemory(null);
    await off.remember('a', 'chat', 'MEMBER', [], [facility]);
    expect(await off.recall('a', 'chat', 'MEMBER')).toEqual([]);
  });

  test('forgets one chat or the whole account', async () => {
    await memory.remember('a', 'one', 'MEMBER', [], [facility]);
    await memory.remember('a', 'two', 'MEMBER', [], [facility]);

    await memory.forget('a', 'one');
    expect(await memory.recall('a', 'one', 'MEMBER')).toEqual([]);
    expect(await memory.recall('a', 'two', 'MEMBER')).toEqual([facility]);

    await memory.clear('a');
    expect(await memory.recall('a', 'two', 'MEMBER')).toEqual([]);
  });
});

describe('what a tool leaves behind', () => {
  test('public ids and names only', () => {
    expect(itemsFrom('list_open_classes', { classes: [{ classId: CLASS, name: 'Yoga', priceVnd: 500_000 }] })).toEqual([
      { type: 'CLASS', id: CLASS, label: 'Yoga' },
    ]);
  });

  test('tools with private results leave nothing', () => {
    const sensitive = { balanceVnd: 900_000, students: [{ studentId: CLASS, name: 'An', healthNotes: 'Hen suyễn' }] };
    for (const tool of ['my_wallet', 'class_roster', 'find_members', 'member_overview', 'my_progress']) {
      expect(itemsFrom(tool, sensitive)).toEqual([]);
    }
  });

  test('rows that do not fit are dropped', () => {
    expect(itemsFrom('list_facilities', { facilities: [{ id: 'not-a-uuid', name: 'Sân' }] })).toEqual([]);
    expect(itemsFrom('list_facilities', { facilities: 'nope' })).toEqual([]);
  });
});
