import type { ListUsersQuery } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import type { AccountStatus, Prisma, Role } from '~/generated/prisma/client';
import { pageArgs } from '~/utils/pagination';

export const accountProfileInclude = {
  memberProfile: true,
  coachProfile: true,
  receptionistProfile: true,
  managerProfile: true,
} satisfies Prisma.AccountInclude;

export type AccountWithProfile = Prisma.AccountGetPayload<{ include: typeof accountProfileInclude }>;

const accountSummarySelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  avatarUrl: true,
  role: true,
  status: true,
  createdAt: true,
} satisfies Prisma.AccountSelect;

export type AccountSummaryRow = Prisma.AccountGetPayload<{ select: typeof accountSummarySelect }>;

class AccountRepository {
  findById = (id: string, role?: Role, tx: Prisma.TransactionClient = prisma) =>
    tx.account.findUnique({ where: { id, role }, include: accountProfileInclude });

  findPage = ({ q, role, status, ...page }: ListUsersQuery, visibleRole?: Role) => {
    const where: Prisma.AccountWhereInput = {
      AND: [
        { role: visibleRole },
        { role, status },
        q
          ? {
              OR: [
                { fullName: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
              ],
            }
          : {},
      ],
    };

    return Promise.all([
      prisma.account.findMany({
        where,
        select: accountSummarySelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(page),
      }),
      prisma.account.count({ where }),
    ]);
  };

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

  create = (data: Prisma.AccountCreateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.account.create({ data, include: accountProfileInclude });

  existsByPhone = async (phone: string, excludeId?: string) =>
    (await prisma.account.count({ where: { phone, ...(excludeId && { id: { not: excludeId } }) } })) > 0;

  updateProfile = (
    id: string,
    data: {
      account: Prisma.AccountUpdateInput;
      memberProfile?: Prisma.MemberProfileUpdateWithoutAccountInput;
      coachProfile?: Prisma.CoachProfileUpdateWithoutAccountInput;
      receptionistProfile?: Prisma.ReceptionistProfileUpdateWithoutAccountInput;
      managerProfile?: Prisma.ManagerProfileUpdateWithoutAccountInput;
    },
    tx: Prisma.TransactionClient = prisma,
  ) =>
    tx.account.update({
      where: { id },
      data: {
        ...data.account,
        ...(data.memberProfile && { memberProfile: { update: data.memberProfile } }),
        ...(data.coachProfile && { coachProfile: { update: data.coachProfile } }),
        ...(data.receptionistProfile && { receptionistProfile: { update: data.receptionistProfile } }),
        ...(data.managerProfile && { managerProfile: { update: data.managerProfile } }),
      },
      include: accountProfileInclude,
    });

  updateStatus = (id: string, status: AccountStatus, tx: Prisma.TransactionClient = prisma) =>
    tx.account.update({ where: { id }, data: { status }, include: accountProfileInclude });

  findActiveManagerIds = async (tx: Prisma.TransactionClient = prisma) =>
    (await tx.account.findMany({ where: { role: 'MANAGER', status: 'ACTIVE' }, select: { id: true } })).map(
      ({ id }) => id,
    );

  updatePassword = (id: string, passwordHash: string, tx: Prisma.TransactionClient = prisma) =>
    tx.account.update({
      where: { id },
      data: { passwordHash, passwordChangedAt: new Date() },
      select: { id: true },
    });

  markEmailVerified = (id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.account.update({ where: { id }, data: { emailVerifiedAt: new Date() }, select: { id: true } });
}

export default new AccountRepository();
