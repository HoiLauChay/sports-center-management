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

  revokeAllByAccountId = (accountId: string, tx: Prisma.TransactionClient = prisma) =>
    tx.refreshToken.updateMany({ where: { accountId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export default new RefreshTokenRepository();
