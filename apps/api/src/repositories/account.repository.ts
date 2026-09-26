import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

export const accountProfileInclude = {
  memberProfile: true,
  coachProfile: true,
  receptionistProfile: true,
  managerProfile: true,
} satisfies Prisma.AccountInclude;

export type AccountWithProfile = Prisma.AccountGetPayload<{ include: typeof accountProfileInclude }>;

class AccountRepository {
  findById = (id: string) => prisma.account.findUnique({ where: { id }, include: accountProfileInclude });

  findByEmail = (email: string) => prisma.account.findUnique({ where: { email }, include: accountProfileInclude });

  existsByEmail = async (email: string) => (await prisma.account.count({ where: { email } })) > 0;

  findAuthStateById = (id: string) =>
    prisma.account.findUnique({
      where: { id },
      select: { id: true, role: true, status: true, passwordChangedAt: true },
    });

  createMember = (
    data: { email: string; fullName: string; passwordHash: string; emailVerifiedAt: Date },
    tx: Prisma.TransactionClient = prisma,
  ) =>
    tx.account.create({
      data: { ...data, role: 'MEMBER', memberProfile: { create: {} } },
      include: accountProfileInclude,
    });

  existsByPhone = async (phone: string, excludeId?: string) =>
    (await prisma.account.count({ where: { phone, ...(excludeId && { id: { not: excludeId } }) } })) > 0;

  updateProfile = (
    id: string,
    data: {
      account: Prisma.AccountUpdateInput;
      memberProfile?: Prisma.MemberProfileUpdateWithoutAccountInput;
      coachProfile?: Prisma.CoachProfileUpdateWithoutAccountInput;
    },
    tx: Prisma.TransactionClient = prisma,
  ) =>
    tx.account.update({
      where: { id },
      data: {
        ...data.account,
        ...(data.memberProfile && { memberProfile: { update: data.memberProfile } }),
        ...(data.coachProfile && { coachProfile: { update: data.coachProfile } }),
      },
      include: accountProfileInclude,
    });

  updatePassword = (id: string, passwordHash: string, tx: Prisma.TransactionClient = prisma) =>
    tx.account.update({
      where: { id },
      data: { passwordHash, passwordChangedAt: new Date() },
      select: { id: true },
    });
}

export default new AccountRepository();
