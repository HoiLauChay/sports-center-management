import { normalizePhone, type ListUsersQuery } from '@sports-center/shared';

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
    const trimmed = q?.trim();
    let searchFilter: Prisma.AccountWhereInput | undefined;

    if (trimmed) {
      // Normalize potential phone inputs (strip spaces, dots, dashes, parentheses).
      const rawDigits = trimmed.replace(/[\s.\-()]/g, '');
      const normalizedPhone = normalizePhone(rawDigits);
      const isDigitsOnly = normalizedPhone.length > 0 && /^\d+$/.test(normalizedPhone);
      const isEmail = trimmed.includes('@');

      if (isEmail) {
        // Query contains '@': strictly search by email.
        searchFilter = { email: { contains: trimmed, mode: 'insensitive' } };
      } else if (isDigitsOnly) {
        // Query is pure digits: search primarily by phone number.
        // Short numbers (< 4 digits): match prefix only (e.g. "098" matches "098...").
        // 4+ digits: allow matching prefix or last digits (e.g. "4321").
        const orConditions: Prisma.AccountWhereInput[] = [
          normalizedPhone.length < 4
            ? { phone: { startsWith: normalizedPhone } }
            : { phone: { contains: normalizedPhone } },
        ];
        // Allow fallback to fullName or email in case name or email username contains digits.
        orConditions.push({ fullName: { contains: trimmed, mode: 'insensitive' } });
        orConditions.push({ email: { contains: trimmed, mode: 'insensitive' } });
        searchFilter = { OR: orConditions };
      } else {
        // Text query: search by fullName or email.
        searchFilter = {
          OR: [
            { fullName: { contains: trimmed, mode: 'insensitive' } },
            { email: { contains: trimmed, mode: 'insensitive' } },
          ],
        };
      }
    }

    const where: Prisma.AccountWhereInput = {
      AND: [{ role: visibleRole }, { role, status }, searchFilter ?? {}],
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
