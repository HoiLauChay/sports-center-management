import { normalizePhone, type ListUsersQuery } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import { Prisma, type AccountStatus, type Role } from '~/generated/prisma/client';
import { pageArgs } from '~/utils/pagination';
import { unaccentContains } from '~/utils/search';

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
  roles: true,
  status: true,
  createdAt: true,
} satisfies Prisma.AccountSelect;

export type AccountSummaryRow = Prisma.AccountGetPayload<{ select: typeof accountSummarySelect }>;

class AccountRepository {
  findById = (id: string, role?: Role, tx: Prisma.TransactionClient = prisma) =>
    tx.account.findUnique({ where: { id, ...(role && { roles: { has: role } }) }, include: accountProfileInclude });

  private idsByName = async (q: string) => {
    const rows = await prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM accounts WHERE ${unaccentContains(Prisma.sql`full_name`, q)}`,
    );
    return rows.map(({ id }) => id);
  };

  findPage = async ({ q, role, status, ...page }: ListUsersQuery, visibleRole?: Role, hiddenRole?: Role) => {
    const trimmed = q?.trim();
    let searchFilter: Prisma.AccountWhereInput | undefined;

    if (trimmed) {
      const rawDigits = trimmed.replace(/[\s.\-()]/g, '');
      const normalizedPhone = normalizePhone(rawDigits);
      const isDigitsOnly = normalizedPhone.length > 0 && /^\d+$/.test(normalizedPhone);
      const isEmail = trimmed.includes('@');

      if (isEmail) {
        searchFilter = { email: { contains: trimmed, mode: 'insensitive' } };
      } else if (isDigitsOnly) {
        const orConditions: Prisma.AccountWhereInput[] = [
          normalizedPhone.length < 4
            ? { phone: { startsWith: normalizedPhone } }
            : { phone: { contains: normalizedPhone } },
        ];
        orConditions.push({ id: { in: await this.idsByName(trimmed) } });
        orConditions.push({ email: { contains: trimmed, mode: 'insensitive' } });
        searchFilter = { OR: orConditions };
      } else {
        searchFilter = {
          OR: [{ id: { in: await this.idsByName(trimmed) } }, { email: { contains: trimmed, mode: 'insensitive' } }],
        };
      }
    }

    const where: Prisma.AccountWhereInput = {
      AND: [
        visibleRole ? { roles: { has: visibleRole } } : {},
        hiddenRole ? { NOT: { roles: { has: hiddenRole } } } : {},
        role ? { roles: { has: role } } : {},
        { status },
        searchFilter ?? {},
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
    data: {
      email: string;
      fullName: string;
      passwordHash: string | null;
      emailVerifiedAt: Date;
      avatarUrl?: string | null;
    },
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

  updateRoles = (id: string, roles: Role[], role: Role, tx: Prisma.TransactionClient = prisma) =>
    tx.account.update({
      where: { id },
      data: {
        roles,
        role,
        ...(roles.includes('MEMBER') && { memberProfile: { upsert: { create: {}, update: {} } } }),
        ...(roles.includes('COACH') && { coachProfile: { upsert: { create: {}, update: {} } } }),
        ...(roles.includes('RECEPTIONIST') && { receptionistProfile: { upsert: { create: {}, update: {} } } }),
      },
      include: accountProfileInclude,
    });

  updateActiveRole = (id: string, role: Role) =>
    prisma.account.update({ where: { id }, data: { role }, include: accountProfileInclude });

  updateStatus = (id: string, status: AccountStatus, tx: Prisma.TransactionClient = prisma) =>
    tx.account.update({ where: { id }, data: { status }, include: accountProfileInclude });

  findActiveManagerIds = (tx: Prisma.TransactionClient = prisma) => this.findActiveIdsWithRoles(['MANAGER'], tx);

  findActiveIdsWithRoles = async (roles: Role[], tx: Prisma.TransactionClient = prisma) =>
    (await tx.account.findMany({ where: { roles: { hasSome: roles }, status: 'ACTIVE' }, select: { id: true } })).map(
      ({ id }) => id,
    );

  updatePassword = (id: string, passwordHash: string, tx: Prisma.TransactionClient = prisma) =>
    tx.account.update({
      where: { id },
      data: { passwordHash, passwordChangedAt: new Date() },
      select: { id: true },
    });

  replaceEmail = (id: string, email: string, tx: Prisma.TransactionClient = prisma) =>
    tx.account.update({
      where: { id },
      data: { email, emailVerifiedAt: null, passwordHash: null, passwordChangedAt: new Date() },
      include: accountProfileInclude,
    });

  fillFromGoogle = (
    account: { id: string; emailVerifiedAt: Date | null; avatarUrl: string | null },
    picture: string | null,
  ) =>
    prisma.account.update({
      where: { id: account.id },
      data: { emailVerifiedAt: account.emailVerifiedAt ?? new Date(), avatarUrl: account.avatarUrl ?? picture },
      include: accountProfileInclude,
    });

  setOwnPassword = async (
    account: { id: string; emailVerifiedAt: Date | null },
    passwordHash: string,
    tx: Prisma.TransactionClient = prisma,
  ) =>
    tx.account.update({
      where: { id: account.id },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        emailVerifiedAt: account.emailVerifiedAt ?? new Date(),
      },
      include: accountProfileInclude,
    });
}

export default new AccountRepository();
