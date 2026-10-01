import { prisma } from '~/configs/db';
import type { BankTransactionStatus, Prisma } from '~/generated/prisma/client';

class BankTransactionRepository {
  insertIfNew = async (data: Prisma.BankTransactionCreateManyInput, tx: Prisma.TransactionClient) =>
    (await tx.bankTransaction.createMany({ data, skipDuplicates: true })).count === 1;

  findBySepayId = (sepayId: bigint, tx: Prisma.TransactionClient = prisma) =>
    tx.bankTransaction.findUniqueOrThrow({ where: { sepayId }, select: { id: true } });

  updateStatus = (id: string, status: BankTransactionStatus, tx: Prisma.TransactionClient) =>
    tx.bankTransaction.update({ where: { id }, data: { status }, select: { id: true } });
}

export default new BankTransactionRepository();
