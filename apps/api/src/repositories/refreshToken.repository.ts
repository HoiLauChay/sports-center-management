import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

class RefreshTokenRepository {
  create = (
    data: { tokenHash: string; userId: string; expiresAt: Date; userAgent?: string; ip?: string },
    tx: Prisma.TransactionClient = prisma,
  ) => tx.refreshToken.create({ data });

  findByHash = (tokenHash: string) =>
    prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, role: true, status: true } } },
    });

  revokeByHash = (tokenHash: string, tx: Prisma.TransactionClient = prisma) =>
    tx.refreshToken.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });

  revokeAllByUserId = (userId: string, tx: Prisma.TransactionClient = prisma) =>
    tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export default new RefreshTokenRepository();
