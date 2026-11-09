import { prisma } from '~/configs/db';
import { Prisma } from '~/generated/prisma/client';

const memberSelect = {
  id: true,
  fullName: true,
  phone: true,
  email: true,
} satisfies Prisma.AccountSelect;

export type MemberContactRow = Prisma.AccountGetPayload<{ select: typeof memberSelect }>;

const isMember = { roles: { has: 'MEMBER' }, status: 'ACTIVE' } satisfies Prisma.AccountWhereInput;

/** Read-only queries behind the manager's AI tools and automation jobs; nothing here writes. */
class ManagerAiRepository {
  countPendingClasses = () => prisma.class.count({ where: { status: 'PENDING_APPROVAL', deletedAt: null } });

  countClassesNeedingCoach = (today: Date) =>
    prisma.class.count({
      where: {
        status: 'OPEN',
        coachId: null,
        deletedAt: null,
        OR: [{ endDate: null }, { endDate: { gte: today } }],
      },
    });

  countUpcomingMaintenances = (now: Date, until: Date) =>
    prisma.facilityMaintenance.count({ where: { deletedAt: null, endAt: { gt: now }, startAt: { lt: until } } });

  /** OPEN classes whose first scheduled session falls in [from, until] and that still miss students. */
  findClassesStartingBetween = (from: Date, until: Date) =>
    prisma.class.findMany({
      where: {
        status: 'OPEN',
        deletedAt: null,
        sessions: { some: { status: 'SCHEDULED', sessionNumber: 1, sessionDate: { gte: from, lte: until } } },
      },
      select: {
        id: true,
        name: true,
        minStudents: true,
        maxStudents: true,
        course: { select: { sport: { select: { name: true } } } },
        _count: { select: { enrollments: { where: { status: 'ENROLLED' } } } },
        sessions: {
          where: { status: 'SCHEDULED' },
          orderBy: { sessionNumber: 'asc' },
          take: 1,
          select: { sessionDate: true, startTime: true },
        },
      },
    });

  findStaleUnmatched = async (before: Date) => {
    const where = { status: 'UNMATCHED', transactionDate: { lt: before } } satisfies Prisma.BankTransactionWhereInput;
    const [count, sum, latest] = await Promise.all([
      prisma.bankTransaction.count({ where }),
      prisma.bankTransaction.aggregate({ where, _sum: { amount: true } }),
      prisma.bankTransaction.findMany({
        where,
        orderBy: { transactionDate: 'asc' },
        take: 5,
        select: { id: true, amount: true, content: true, transactionDate: true },
      }),
    ]);
    return { count, amount: Number(sum._sum.amount ?? 0), latest };
  };

  findOverdueSupport = async (before: Date) => {
    const where = {
      status: 'OPEN',
      deletedAt: null,
      createdAt: { lt: before },
    } satisfies Prisma.SupportRequestWhereInput;
    const [count, latest] = await Promise.all([
      prisma.supportRequest.count({ where }),
      prisma.supportRequest.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take: 5,
        select: { id: true, subject: true, createdAt: true },
      }),
    ]);
    return { count, latest };
  };

  /** Active members who joined before `since` and have not booked, attended or checked in since then. */
  findInactiveMembers = async (since: Date) => {
    const where = {
      ...isMember,
      createdAt: { lt: since },
      facilityBookings: { none: { createdAt: { gte: since } } },
      checkins: { none: { checkInTime: { gte: since } } },
      attendances: { none: { createdAt: { gte: since } } },
      classEnrollments: { none: { status: 'ENROLLED', class: { endDate: { gte: since } } } },
    } satisfies Prisma.AccountWhereInput;
    const [count, sample] = await Promise.all([
      prisma.account.count({ where }),
      prisma.account.findMany({ where, orderBy: { createdAt: 'asc' }, take: 10, select: memberSelect }),
    ]);
    return { count, sample };
  };

  findAccountIds = (role: 'MANAGER' | 'RECEPTIONIST') =>
    prisma.account
      .findMany({ where: { roles: { has: role }, status: 'ACTIVE' }, select: { id: true } })
      .then((rows) => rows.map(({ id }) => id));

  /** Sessions a coach actually taught (or is set to teach) in the range, with the class's coach as fallback. */
  findSessionsForWorkload = (from: Date, to: Date) =>
    prisma.classSession.findMany({
      where: { status: 'SCHEDULED', sessionDate: { gte: from, lte: to }, class: { status: 'OPEN' } },
      select: {
        classId: true,
        coach: { select: { id: true, fullName: true } },
        class: {
          select: {
            name: true,
            coach: { select: { id: true, fullName: true } },
            _count: { select: { enrollments: { where: { status: 'ENROLLED' } } } },
          },
        },
        evaluations: { where: { deletedAt: null }, select: { rating: true } },
      },
    });

  findMembersByPhones = (phones: string[]) =>
    phones.length
      ? prisma.account.findMany({ where: { ...isMember, phone: { in: phones } }, select: memberSelect, take: 5 })
      : Promise.resolve([]);

  /** Members whose full name (accents ignored) appears inside the transfer content. */
  findMembersNamedIn = async (content: string) => {
    const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM accounts
      WHERE 'MEMBER' = ANY(roles) AND status = 'ACTIVE' AND length(full_name) >= 6
        AND unaccent(lower(${content})) LIKE '%' || unaccent(lower(full_name)) || '%'
      LIMIT 5`);
    return rows.length
      ? prisma.account.findMany({ where: { id: { in: rows.map(({ id }) => id) } }, select: memberSelect })
      : [];
  };

  /** Members with an invoice for this exact amount created around the transfer time. */
  findMembersWithInvoiceOf = (amount: number, from: Date, to: Date) =>
    prisma.invoice.findMany({
      where: { amount, accountId: { not: null }, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        status: true,
        paymentCode: true,
        createdAt: true,
        account: { select: { account: { select: memberSelect } } },
      },
    });

  /** Who recently used a facility: bookers and the students of classes held there, over a window around now. */
  findFacilityUsers = async (facilityId: string, from: Date, to: Date) => {
    const [bookings, enrollments] = await Promise.all([
      prisma.facilityBooking.findMany({
        where: { facilityId, accountId: { not: null }, bookingDate: { gte: from, lte: to } },
        distinct: ['accountId'],
        select: { accountId: true },
      }),
      prisma.classEnrollment.findMany({
        where: {
          status: 'ENROLLED',
          class: { status: 'OPEN', sessions: { some: { facilityId, sessionDate: { gte: from, lte: to } } } },
        },
        distinct: ['accountId'],
        select: { accountId: true },
      }),
    ]);
    return [...new Set([...bookings.map(({ accountId }) => accountId!), ...enrollments.map((row) => row.accountId)])];
  };

  findAutomationSettings = () => prisma.automationSetting.findMany();

  upsertAutomationSetting = (
    key: string,
    data: { enabled?: boolean; threshold?: number; updatedById?: string; lastRunAt?: Date },
  ) => prisma.automationSetting.upsert({ where: { key }, create: { key, ...data }, update: data });
}

export default new ManagerAiRepository();
