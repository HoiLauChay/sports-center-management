/* eslint-disable no-console */
/**
 * Fills the member-facing catalog with classes that are still open for enrollment: two courses per
 * sport and three classes each, starting 2–20 days from today, with real enrollments so seats range
 * from full to nearly empty. Also adds a membership package with a class discount and gives it to
 * one member who has no active package, so member prices show on the class pages.
 * Works on whatever sports, facilities and approved coaches are in the database (run db:seed first).
 * Re-runnable: everything it creates has fixed ids; classes and sessions are rebuilt, orders are reused.
 * Nothing else in the database is touched.
 */
import { createHash } from 'node:crypto';

import { prisma } from '~/configs/db';
import { addDays, parseTime, toDbTime, todayInCenter } from '~/utils/time';

const KEY_PREFIX = 'seed:catalog:';
const DISCOUNT_PACKAGE_NAME = 'Gói Học viên 3 tháng';
const DEMO_EMAIL_DOMAIN = '@sportscenter.local';

/** Same key, same uuid on every run. */
const idOf = (key: string) => {
  const hex = createHash('sha1')
    .update(KEY_PREFIX + key)
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

interface Slot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

/** Weekly patterns the classes rotate through; the first that fits the facility is used. */
const PATTERNS: Slot[][] = [
  [
    { dayOfWeek: 2, startTime: '18:00', endTime: '19:30' },
    { dayOfWeek: 4, startTime: '18:00', endTime: '19:30' },
  ],
  [{ dayOfWeek: 6, startTime: '08:00', endTime: '10:00' }],
  [
    { dayOfWeek: 1, startTime: '17:30', endTime: '19:00' },
    { dayOfWeek: 3, startTime: '17:30', endTime: '19:00' },
  ],
  [{ dayOfWeek: 0, startTime: '09:00', endTime: '11:00' }],
  [
    { dayOfWeek: 3, startTime: '06:00', endTime: '07:00' },
    { dayOfWeek: 5, startTime: '06:00', endTime: '07:00' },
  ],
  [{ dayOfWeek: 5, startTime: '19:00', endTime: '21:00' }],
  [
    { dayOfWeek: 2, startTime: '20:00', endTime: '21:30' },
    { dayOfWeek: 6, startTime: '15:00', endTime: '16:30' },
  ],
];

/** How full each class gets, as seats left: 0 = full. Rotates so every sport shows a mix. */
const SEATS_LEFT = [0, 2, 5, 1, 8, 3, 0, 6, 1, 10];

/** Session dates from the first weekly slot on or after `from`, until `count` sessions. */
const sessionDates = (from: string, pattern: Slot[], count: number) => {
  const dates: { date: string; slot: Slot }[] = [];
  for (let day = 0; dates.length < count && day < 400; day++) {
    const date = addDays(from, day);
    for (const slot of pattern) if (slot.dayOfWeek === weekday(date)) dates.push({ date, slot });
  }
  return dates.slice(0, count);
};

const overlaps = (aStart: number, aEnd: number, bStart: Date, bEnd: Date) => {
  const start = bStart.getUTCHours() * 60 + bStart.getUTCMinutes();
  const end = bEnd.getUTCHours() * 60 + bEnd.getUTCMinutes();
  return aStart < end && start < aEnd;
};

async function isFacilityFree(facilityId: string, sessions: { date: string; slot: Slot }[], classIds: string[]) {
  const dates = [...new Set(sessions.map(({ date }) => new Date(date)))];
  const [taken, booked] = await Promise.all([
    prisma.classSession.findMany({
      where: { facilityId, sessionDate: { in: dates }, status: { not: 'CANCELLED' }, classId: { notIn: classIds } },
      select: { sessionDate: true, startTime: true, endTime: true },
    }),
    prisma.facilityBooking.findMany({
      where: { facilityId, bookingDate: { in: dates }, status: 'CONFIRMED' },
      select: { bookingDate: true, startTime: true, endTime: true },
    }),
  ]);
  const busy = [
    ...taken.map((row) => ({ day: row.sessionDate, start: row.startTime, end: row.endTime })),
    ...booked.map((row) => ({ day: row.bookingDate, start: row.startTime, end: row.endTime })),
  ];
  return sessions.every(({ date, slot }) => {
    const start = parseTime(slot.startTime);
    const end = parseTime(slot.endTime);
    return !busy.some((row) => row.day.toISOString().slice(0, 10) === date && overlaps(start, end, row.start, row.end));
  });
}

let orderCount = 0;
/** Orders can't be deleted (the ledger is append-only), so a re-run reuses the order it made before. */
async function ensureOrderItem(
  accountId: string,
  key: string,
  type: 'COURSE_ENROLLMENT' | 'MEMBERSHIP',
  amount: number,
) {
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: KEY_PREFIX + key },
    select: { items: { select: { id: true } } },
  });
  if (existing) return existing.items[0]!.id;
  const order = await prisma.order.create({
    data: {
      orderNumber: `SEED-CAT-${Date.now().toString(36).toUpperCase()}-${++orderCount}`,
      idempotencyKey: KEY_PREFIX + key,
      accountId,
      receiptSnapshot: { schema_version: 1 },
      subtotal: amount,
      totalAmount: amount,
      paymentMethod: 'WALLET',
      items: {
        create: { lineNumber: 1, type, itemSnapshot: { schema_version: 1 }, subtotal: amount, totalAmount: amount },
      },
    },
    select: { items: { select: { id: true } } },
  });
  return order.items[0]!.id;
}

async function seedDiscountMembership(today: string) {
  const benefits = {
    gymAccess: true,
    bookingDiscountPct: 10,
    classDiscountPct: 20,
    freeBookingSlotsPerMonth: 2,
    aiQuestionsPerMonth: 200,
  };
  const pkg = await prisma.membership.upsert({
    where: { id: idOf('package') },
    update: { ...benefits, isActive: true, deletedAt: null },
    create: {
      id: idOf('package'),
      name: DISCOUNT_PACKAGE_NAME,
      description: 'Giảm 20% học phí mọi lớp, giảm 10% phí đặt sân.',
      price: 750_000,
      durationDays: 90,
      ...benefits,
    },
  });

  const holder =
    (await prisma.account.findFirst({
      where: { email: { endsWith: DEMO_EMAIL_DOMAIN }, memberships: { some: { packageId: pkg.id, status: 'ACTIVE' } } },
    })) ??
    (await prisma.account.findFirst({
      where: {
        role: 'MEMBER',
        status: 'ACTIVE',
        email: { endsWith: DEMO_EMAIL_DOMAIN },
        memberships: { none: { status: 'ACTIVE' } },
      },
      orderBy: { email: 'asc' },
    }));
  if (!holder) return null;

  const membershipId = idOf(`membership:${holder.id}`);
  const membership = await prisma.memberMembership.upsert({
    where: { id: membershipId },
    update: {},
    create: {
      id: membershipId,
      accountId: holder.id,
      packageId: pkg.id,
      startDate: new Date(addDays(today, -10)),
      endDate: new Date(addDays(today, 80)),
      autoRenew: true,
    },
  });
  const orderItemId = await ensureOrderItem(holder.id, `membership:${holder.id}`, 'MEMBERSHIP', 750_000);
  await prisma.membershipOrder.upsert({
    where: { orderItemId },
    update: {},
    create: {
      membershipId: membership.id,
      orderItemId,
      periodStart: membership.startDate,
      periodEnd: membership.endDate,
      ...benefits,
    },
  });
  return holder.email;
}

async function seedCatalog() {
  const today = todayInCenter();
  const manager = await prisma.account.findFirst({ where: { role: 'MANAGER' } });
  if (!manager) throw new Error('Please run bun run db:seed first to create the manager!');

  const sports = await prisma.sport.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      facilities: { where: { facility: { deletedAt: null } }, select: { facilityId: true } },
      coachSpecializations: { where: { status: 'APPROVED' }, select: { coachId: true } },
    },
  });
  const members = await prisma.account.findMany({
    where: { role: 'MEMBER', status: 'ACTIVE' },
    orderBy: { email: 'asc' },
    select: { id: true },
  });

  console.log(`Seeding catalog for ${today}...`);

  let classIndex = 0;
  let created = 0;
  for (const sport of sports) {
    const coachIds = sport.coachSpecializations.map(({ coachId }) => coachId);
    const facilityIds = sport.facilities.map(({ facilityId }) => facilityId);
    if (!coachIds.length || !facilityIds.length) {
      console.log(`  - ${sport.name}: skipped (needs an approved coach and a facility)`);
      continue;
    }

    const courses = [
      { key: 'basic', name: `${sport.name} cơ bản`, sessions: 10, price: 1_200_000 },
      { key: 'advanced', name: `${sport.name} nâng cao`, sessions: 14, price: 1_800_000 },
    ];
    for (const course of courses) {
      await prisma.course.upsert({
        where: { id: idOf(`course:${sport.id}:${course.key}`) },
        update: { name: course.name, totalSessions: course.sessions, price: course.price, deletedAt: null },
        create: {
          id: idOf(`course:${sport.id}:${course.key}`),
          name: course.name,
          sportId: sport.id,
          totalSessions: course.sessions,
          price: course.price,
          description: `Khóa ${course.name.toLowerCase()} theo giáo trình của trung tâm.`,
        },
      });
    }

    const plans = [
      { course: courses[0]!, label: 'Lớp 1' },
      { course: courses[1]!, label: 'Lớp 1' },
      { course: courses[0]!, label: 'Lớp 2' },
    ];
    for (const [i, plan] of plans.entries()) {
      const classId = idOf(`class:${sport.id}:${plan.course.key}:${plan.label}`);
      const startDate = addDays(today, 2 + ((classIndex * 3) % 19));
      const facilityId = facilityIds[i % facilityIds.length]!;
      const coachId = coachIds[i % coachIds.length]!;

      let pattern: Slot[] | null = null;
      let sessions: { date: string; slot: Slot }[] = [];
      for (let p = 0; p < PATTERNS.length && !pattern; p++) {
        const candidate = PATTERNS[(classIndex + p) % PATTERNS.length]!;
        const dates = sessionDates(startDate, candidate, plan.course.sessions);
        if (await isFacilityFree(facilityId, dates, [classId])) [pattern, sessions] = [candidate, dates];
      }
      classIndex++;
      if (!pattern) {
        console.log(`  - ${sport.name} ${plan.label}: skipped (facility busy at every slot)`);
        continue;
      }

      const maxStudents = 6 + ((classIndex * 5) % 11);
      const seatsLeft = Math.min(maxStudents, SEATS_LEFT[classIndex % SEATS_LEFT.length]!);
      const data = {
        name: `${plan.course.name} - ${plan.label}`,
        courseId: idOf(`course:${sport.id}:${plan.course.key}`),
        facilityId,
        coachId,
        minStudents: 2,
        maxStudents,
        startDate: new Date(sessions[0]!.date),
        endDate: new Date(sessions.at(-1)!.date),
        weeklySchedule: pattern.map((slot) => ({ ...slot })),
        status: 'OPEN' as const,
        approvedById: manager.id,
        approvedAt: new Date(),
        cancelReason: null,
        deletedAt: null,
      };
      await prisma.class.upsert({ where: { id: classId }, update: data, create: { id: classId, ...data } });

      await prisma.classSession.deleteMany({ where: { classId } });
      await prisma.classSession.createMany({
        data: sessions.map(({ date, slot }, n) => ({
          classId,
          facilityId,
          coachId,
          sessionNumber: n + 1,
          sessionDate: new Date(date),
          startTime: toDbTime(parseTime(slot.startTime)),
          endTime: toDbTime(parseTime(slot.endTime)),
        })),
      });

      const enrolled = Math.min(members.length, maxStudents - seatsLeft);
      for (let m = 0; m < enrolled; m++) {
        const member = members[(classIndex * 7 + m) % members.length]!;
        const orderItemId = await ensureOrderItem(
          member.id,
          `class:${classId}:${member.id}`,
          'COURSE_ENROLLMENT',
          plan.course.price,
        );
        await prisma.classEnrollment.upsert({
          where: { orderItemId },
          update: {},
          create: { classId, accountId: member.id, orderItemId },
        });
      }
      created++;
      console.log(`  ✓ ${data.name}: ${enrolled}/${maxStudents}, khai giảng ${sessions[0]!.date}`);
    }
  }

  const holder = await seedDiscountMembership(today);
  console.log(`✓ ${created} open classes`);
  console.log(
    holder
      ? `✓ ${DISCOUNT_PACKAGE_NAME} (−20% học phí) active for ${holder}`
      : `! ${DISCOUNT_PACKAGE_NAME} created, but every member already has an active package`,
  );
}

seedCatalog()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
