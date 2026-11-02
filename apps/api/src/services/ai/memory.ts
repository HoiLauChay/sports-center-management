import type { AssistantRole } from '@sports-center/shared';
import { z } from 'zod';

import { redis } from '~/configs/redis';

const TTL_SECONDS = 30 * 60;
const MAX_ITEMS = 20;
const MAX_LABEL = 60;
const TIMEOUT_MS = 1000;

/** Public things the chat already looked up. Never money, health or contact details: tools below list what is kept. */
const memoryItemSchema = z.object({
  type: z.enum(['FACILITY', 'CLASS', 'SESSION', 'PACKAGE']),
  id: z.uuid(),
  label: z.string().min(1).max(MAX_LABEL),
});
export type MemoryItem = z.infer<typeof memoryItemSchema>;

const storedSchema = z.object({
  role: z.string(),
  items: z.array(memoryItemSchema).max(MAX_ITEMS),
});

export interface MemoryStore {
  hget: (key: string, field: string) => Promise<unknown>;
  hset: (key: string, values: Record<string, unknown>) => Promise<unknown>;
  expire: (key: string, seconds: number) => Promise<unknown>;
  hdel: (key: string, field: string) => Promise<unknown>;
  del: (key: string) => Promise<unknown>;
}

type Row = Record<string, unknown>;

const rows = (result: unknown, key: string): Row[] => {
  const list = (result as Row | null)?.[key];
  return Array.isArray(list) ? (list as Row[]) : [];
};

const reader =
  (type: MemoryItem['type'], list: string, id: string, label: string) =>
  (result: unknown): unknown[] =>
    rows(result, list).map((row) => ({ type, id: row[id], label: String(row[label] ?? '').slice(0, MAX_LABEL) }));

/** What each tool leaves behind. A tool that is not listed leaves nothing, so private results are never stored. */
const REMEMBERED: Record<string, (result: unknown) => unknown[]> = {
  list_facilities: reader('FACILITY', 'facilities', 'id', 'name'),
  find_available_slots: reader('FACILITY', 'facilities', 'facilityId', 'facility'),
  list_open_classes: reader('CLASS', 'classes', 'classId', 'name'),
  my_enrollments: reader('CLASS', 'enrollments', 'classId', 'className'),
  coach_classes: reader('CLASS', 'classes', 'classId', 'name'),
  find_classes: reader('CLASS', 'classes', 'classId', 'name'),
  list_memberships: reader('PACKAGE', 'packages', 'packageId', 'name'),
  coach_schedule: reader('SESSION', 'sessions', 'sessionId', 'className'),
};

/** The things a tool result is worth remembering; anything that does not fit the schema is dropped. */
export const itemsFrom = (tool: string, result: unknown): MemoryItem[] =>
  (REMEMBERED[tool]?.(result) ?? []).flatMap((item) => {
    const parsed = memoryItemSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });

/** Memory is a convenience: when Redis is slow, down or not configured the chat goes on without it. */
const guarded = async <T>(work: () => Promise<T>): Promise<T | null> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('timed out')), TIMEOUT_MS);
      }),
    ]);
  } catch (err) {
    console.error('Assistant memory failed:', err instanceof Error ? err.message : 'unknown error');
    return null;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Lets a follow-up question reuse the ids found earlier in a chat. One Redis hash per account, keyed from the session
 * and never from the request, holds one field per conversation, so knowing a conversation id gives nobody else's
 * memory. Ids only save a lookup: the tools still check permissions and read fresh data.
 */
export class AssistantMemory {
  constructor(private readonly store: MemoryStore | null) {}

  private keyOf = (accountId: string) => `assistant:ctx:${accountId}`;

  recall = async (
    accountId: string,
    conversationId: string | undefined,
    role: AssistantRole,
  ): Promise<MemoryItem[]> => {
    const { store } = this;
    if (!store || !conversationId) return [];
    const stored = await guarded(() => store.hget(this.keyOf(accountId), conversationId));
    const parsed = storedSchema.safeParse(stored);
    return parsed.success && parsed.data.role === role ? parsed.data.items : [];
  };

  remember = async (
    accountId: string,
    conversationId: string | undefined,
    role: AssistantRole,
    previous: MemoryItem[],
    found: MemoryItem[],
  ) => {
    const { store } = this;
    if (!store || !conversationId || !found.length) return;
    // Newest last, so the limit drops what was mentioned longest ago.
    const byId = new Map([...previous, ...found].map((item) => [item.id, item]));
    const items = [...byId.values()].slice(-MAX_ITEMS);
    const key = this.keyOf(accountId);
    await guarded(async () => {
      await store.hset(key, { [conversationId]: { role, items } });
      await store.expire(key, TTL_SECONDS);
    });
  };

  forget = async (accountId: string, conversationId: string) => {
    const { store } = this;
    if (store) await guarded(() => store.hdel(this.keyOf(accountId), conversationId));
  };

  clear = async (accountId: string) => {
    const { store } = this;
    if (store) await guarded(() => store.del(this.keyOf(accountId)));
  };
}

export default new AssistantMemory(redis as MemoryStore | null);
