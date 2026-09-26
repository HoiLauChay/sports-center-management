import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';
import { isRetryableTransactionError } from '~/utils/dbError';

const MAX_ATTEMPTS = 3;
const SCHEDULE_LOCK = [74001, 1] as const;

const LOCK_ORDER = [
  ['accounts', 'accounts', 'id'],
  ['memberProfiles', 'member_profile', 'account_id'],
  ['classes', 'classes', 'id'],
  ['facilities', 'facilities', 'id'],
  ['memberMemberships', 'member_memberships', 'id'],
  ['coupons', 'coupons', 'id'],
  ['orders', 'orders', 'id'],
  ['orderItems', 'order_items', 'id'],
  ['walletTopUps', 'wallet_top_ups', 'id'],
  ['bankTransactions', 'bank_transactions', 'id'],
] as const;

export type LockTargets = { systemSettings?: 'share' | 'update' } & {
  [K in (typeof LOCK_ORDER)[number][0]]?: string[];
};

export const runTransaction = async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(fn);
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS || !isRetryableTransactionError(err)) throw err;
    }
  }
};

export const withScheduleLock = (tx: Prisma.TransactionClient) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(${SCHEDULE_LOCK[0]}::int, ${SCHEDULE_LOCK[1]}::int)`;

export const lockRows = async (tx: Prisma.TransactionClient, targets: LockTargets) => {
  if (targets.systemSettings) {
    await tx.$queryRawUnsafe(
      `SELECT 1 FROM system_settings FOR ${targets.systemSettings === 'update' ? 'UPDATE' : 'SHARE'}`,
    );
  }

  for (const [key, table, column] of LOCK_ORDER) {
    const ids = targets[key];
    if (!ids?.length) continue;
    const sorted = [...new Set(ids)].sort();
    await tx.$queryRawUnsafe(
      `SELECT 1 FROM ${table} WHERE ${column} = ANY($1::uuid[]) ORDER BY ${column} FOR UPDATE`,
      sorted,
    );
  }
};
