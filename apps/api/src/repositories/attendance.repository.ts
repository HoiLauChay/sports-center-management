import { prisma } from '~/configs/db';
import { Prisma } from '~/generated/prisma/client';
import { formatDate, fromDbTime, toCenterDateTime } from '~/utils/time';

const person = { select: { id: true, fullName: true } } as const;
const attendanceSelect = {
  id: true,
  sessionId: true,
  accountId: true,
  status: true,
  note: true,
  updatedById: true,
  updatedBy: person,
  updatedAt: true,
} satisfies Prisma.ClassAttendanceSelect;

const sessionSelect = {
  id: true,
  classId: true,
  sessionNumber: true,
  sessionDate: true,
  startTime: true,
  endTime: true,
  facility: { select: { id: true, name: true } },
  status: true,
  cancelReason: true,
  class: { select: { coachId: true, deletedAt: true } },
} satisfies Prisma.ClassSessionSelect;

export type AttendanceRow = Prisma.ClassAttendanceGetPayload<{ select: typeof attendanceSelect }>;
export type AttendanceSessionRow = Prisma.ClassSessionGetPayload<{ select: typeof sessionSelect }>;

export const sessionStart = (session: Pick<AttendanceSessionRow, 'sessionDate' | 'startTime'>) =>
  toCenterDateTime(formatDate(session.sessionDate), fromDbTime(session.startTime));

const enrolledAtSession = (start: Date): Prisma.ClassEnrollmentWhereInput => ({
  enrolledAt: { lte: start },
  OR: [{ cancelledAt: null }, { cancelledAt: { gt: start } }],
});

// Bind ISO text as timestamptz so the database session timezone cannot reinterpret UTC.
// EXISTS prevents duplicate members after cancellation and re-enrollment.
const missingDefaults = (now: Date) => Prisma.sql`
  SELECT s.id AS "sessionId", s.class_id AS "classId", e.account_id AS "accountId"
  FROM class_sessions s
  JOIN (SELECT DISTINCT class_id, account_id FROM class_enrollments) e ON e.class_id = s.class_id
  WHERE s.status = 'SCHEDULED'
    AND (s.session_date + s.end_time) AT TIME ZONE 'Asia/Ho_Chi_Minh' <= ${now.toISOString()}::timestamptz
    AND EXISTS (
      SELECT 1 FROM class_enrollments history
      WHERE history.class_id = s.class_id AND history.account_id = e.account_id
        AND history.enrolled_at <= (s.session_date + s.start_time) AT TIME ZONE 'Asia/Ho_Chi_Minh'
        AND (history.cancelled_at IS NULL
          OR history.cancelled_at > (s.session_date + s.start_time) AT TIME ZONE 'Asia/Ho_Chi_Minh')
    )
    AND NOT EXISTS (
      SELECT 1 FROM class_attendance a WHERE a.session_id = s.id AND a.account_id = e.account_id
    )
`;

class AttendanceRepository {
  findSession = (id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.classSession.findUnique({ where: { id }, select: sessionSelect });

  findRoster = (session: AttendanceSessionRow, tx: Prisma.TransactionClient = prisma) =>
    tx.account.findMany({
      where: { classEnrollments: { some: { classId: session.classId, ...enrolledAtSession(sessionStart(session)) } } },
      select: { id: true, fullName: true },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
    });

  findBySession = (sessionId: string, tx: Prisma.TransactionClient = prisma) =>
    tx.classAttendance.findMany({ where: { sessionId }, select: attendanceSelect });

  save = (data: Prisma.ClassAttendanceUncheckedCreateInput, tx: Prisma.TransactionClient) =>
    tx.classAttendance.upsert({
      where: { sessionId_accountId: { sessionId: data.sessionId, accountId: data.accountId } },
      create: data,
      update: { status: data.status, note: data.note, updatedById: data.updatedById },
      select: attendanceSelect,
    });

  findMine = async (accountId: string, classId?: string) => {
    const sessions = await prisma.classSession.findMany({
      where: { classId, class: { enrollments: { some: { accountId } } } },
      select: {
        ...sessionSelect,
        class: {
          select: { enrollments: { where: { accountId }, select: { enrolledAt: true, cancelledAt: true } } },
        },
        attendances: { where: { accountId }, select: { status: true, note: true } },
      },
      orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }, { id: 'asc' }],
    });
    return sessions.filter((session) => {
      const start = sessionStart(session);
      return session.class.enrollments.some((e) => e.enrolledAt <= start && (!e.cancelledAt || e.cancelledAt > start));
    });
  };

  findMissingDefaults = (now: Date, limit: number, tx: Prisma.TransactionClient) =>
    tx.$queryRaw<{ sessionId: string; classId: string; accountId: string }[]>(Prisma.sql`
      ${missingDefaults(now)} ORDER BY s.session_date, s.end_time, s.id, e.account_id LIMIT ${limit}
    `);

  countMissingDefaults = async (now: Date, tx: Prisma.TransactionClient) => {
    const [row] = await tx.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT count(*) FROM (${missingDefaults(now)}) missing
    `);
    return Number(row!.count);
  };

  createDefaults = (data: Prisma.ClassAttendanceCreateManyInput[], tx: Prisma.TransactionClient) =>
    tx.classAttendance.createManyAndReturn({ data, skipDuplicates: true, select: attendanceSelect });
}

export default new AttendanceRepository();
