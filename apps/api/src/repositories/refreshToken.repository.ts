import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

class RefreshTokenRepository {
  create = (
    data: { tokenHash: string; accountId: string; expiresAt: Date; userAgent?: string; ip?: string },
    tx: Prisma.TransactionClient = prisma,
  ) => tx.refreshToken.create({ data });

  findByHash = (tokenHash: string) =>
    prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { account: { select: { id: true, role: true, status: true } } },
    });

  revokeByHash = (tokenHash: string, tx: Prisma.TransactionClient = prisma) =>
    tx.refreshToken.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });

  /** Revokes a token because a refresh replaced it; only such a token gets the short reuse grace. */
  rotateByHash = (tokenHash: string, tx: Prisma.TransactionClient = prisma) => {
    const now = new Date();
    return tx.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: now, rotatedAt: now },
    });
  };

  /** Whether a logout, a password change or a lock revoked a token of the account after `since`. */
  hasDeliberateRevocationSince = async (accountId: string, since: Date) =>
    (await prisma.refreshToken.count({ where: { accountId, rotatedAt: null, revokedAt: { gt: since } } })) > 0;

  revokeAllByAccountId = (accountId: string, tx: Prisma.TransactionClient = prisma) =>
    tx.refreshToken.updateMany({ where: { accountId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export default new RefreshTokenRepository();
