import { prisma } from '~/configs/db';
import type { OtpPurpose, Prisma } from '~/generated/prisma/client';

class OtpRepository {
  findLatestActive = (email: string, purpose: OtpPurpose) =>
    prisma.otpCode.findFirst({
      where: { email, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

  create = (data: { email: string; purpose: OtpPurpose; codeHash: string; expiresAt: Date }) =>
    prisma.otpCode.create({ data });

  invalidateAll = (email: string, purpose: OtpPurpose, tx: Prisma.TransactionClient = prisma) =>
    tx.otpCode.updateMany({ where: { email, purpose, consumedAt: null }, data: { consumedAt: new Date() } });

  incrementAttempts = (id: string) => prisma.otpCode.update({ where: { id }, data: { attempts: { increment: 1 } } });

  consume = (id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.otpCode.update({ where: { id }, data: { consumedAt: new Date() } });
}

export default new OtpRepository();
