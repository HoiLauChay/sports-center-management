/* eslint-disable no-console */
/**
 * Data for trying coach1's AI assistant tools: two new rooms, 20 new students and two classes.
 * - "Thể lực Tổng hợp K02" is mid-course: older sessions have attendance, results and notes, the last two past
 *   sessions are still unmarked (coach_todo, propose_attendance), and one session started a little while ago today
 *   so its attendance is open right now.
 * - "Bơi Cơ bản Người lớn K05" starts in a few days: a full roster, nothing taught yet.
 * Needs db:seed:demo first. Re-runnable: students and rooms are upserted, both classes' timelines are rebuilt from
 * today's date and time on every run.
 */
import { prisma } from '~/configs/db';
import type { AttendanceStatus, Gender, Prisma } from '~/generated/prisma/client';
import { hashPassword } from '~/utils/password';
import { addDays, minutesInCenter, parseTime, toCenterDateTime, toDbTime, todayInCenter } from '~/utils/time';

const DEMO_PASSWORD = 'Demo@1234';
const COURSE_FITNESS_ID = 'c0a10000-0000-4000-8000-0000000000a1';
const COURSE_SWIM_ID = 'c0a10000-0000-4000-8000-0000000000a2';
const CLASS_FITNESS_ID = 'c1a10000-0000-4000-8000-0000000000a1';
const CLASS_SWIM_ID = 'c1a10000-0000-4000-8000-0000000000a2';

const ROOMS = [
  { name: 'Phòng Thể lực 2', type: 'GYM', capacityPerSlot: 20, pricePerSlot: 45000, sport: 'Gym' },
  { name: 'Hồ bơi phụ', type: 'ROOM', capacityPerSlot: 16, pricePerSlot: 50000, sport: 'Bơi lội' },
] as const;

const PEOPLE: [string, Gender][] = [
  ['Phúc Đức Phạm', 'MALE'],
  ['Nguyễn Thảo Vy', 'FEMALE'],
  ['Trần Minh Quân', 'MALE'],
  ['Lê Ngọc Trâm', 'FEMALE'],
  ['Võ Hoàng Phúc', 'MALE'],
  ['Đoàn Thị Mai Anh', 'FEMALE'],
  ['Phùng Gia Huy', 'MALE'],
  ['Hà Bảo Ngọc', 'FEMALE'],
  ['Lục Thành Đạt', 'MALE'],
  ['Khúc Minh Thư', 'FEMALE'],
  ['Bạch Quốc Việt', 'MALE'],
  ['Tăng Thu Hiền', 'FEMALE'],
  ['Viên Đức Anh', 'MALE'],
  ['Mẫn Khánh Vân', 'FEMALE'],
  ['Doãn Tiến Dũng', 'MALE'],
  ['Thân Ngọc Ánh', 'FEMALE'],
  ['Vi Văn Toàn', 'MALE'],
  ['Lã Phương Nhi', 'FEMALE'],
  ['Kha Minh Nhật', 'MALE'],
  ['Nghiêm Hải Yến', 'FEMALE'],
];

const GOALS = [
  'Giảm 5kg trong 3 tháng',
  'Tăng sức bền để chạy 10km',
  'Cải thiện tư thế, đỡ đau lưng khi ngồi nhiều',
  'Tăng cơ tay và vai',
  'Bơi được 200m không nghỉ',
  'Hết sợ nước, tự tin xuống hồ sâu',
  'Giữ dáng sau sinh',
  'Chuẩn bị thể lực cho giải chạy bán marathon',
];
const HEALTH = [
  'Từng chấn thương dây chằng gối trái',
  'Huyết áp hơi cao, tránh nín thở khi gắng sức',
  'Hen suyễn nhẹ, mang theo thuốc xịt',
  'Thoát vị đĩa đệm L4-L5, tránh gập lưng nặng',
];
const NOTES = [
  ['Khởi động và đánh giá thể lực', 'Đo nhịp tim nghỉ, test plank và squat 1 phút.', 'Đi bộ nhanh 30 phút mỗi ngày'],
  ['Kỹ thuật squat và hip hinge', 'Tập squat với gậy, sửa tư thế lưng thẳng.', 'Squat 3x15 tại nhà'],
  ['Sức bền tim phổi', 'Circuit 4 trạm x 3 vòng, nghỉ 60 giây.', 'Chạy chậm 20 phút x 3 buổi'],
  ['Thân trên: đẩy và kéo', 'Hít đất biến thể, kéo dây kháng lực.', 'Hít đất 3x10'],
  ['Core và thăng bằng', 'Plank, dead bug, bird dog.', 'Plank 3x45 giây'],
  ['HIIT nhẹ', 'Interval 30/30 x 10 hiệp.', 'Giãn cơ 10 phút mỗi tối'],
];

/** Deterministic randomness: every run produces the same people and the same results. */
const random = (() => {
  let seed = 20261028;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();
const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]!;
const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));

type Slot = { dayOfWeek: number; startTime: string; endTime: string };
const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

async function seedRooms() {
  const ids: string[] = [];
  for (const { sport, ...room } of ROOMS) {
    const sportRow = await prisma.sport.findFirst({ where: { name: sport }, select: { id: true } });
    if (!sportRow) throw new Error(`Không thấy bộ môn ${sport}. Chạy bun run db:seed:demo trước.`);
    const existing = await prisma.facility.findFirst({
      where: { name: room.name, deletedAt: null },
      select: { id: true },
    });
    const { id } = existing ?? (await prisma.facility.create({ data: room, select: { id: true } }));
    await prisma.facilitySport.createMany({ data: [{ facilityId: id, sportId: sportRow.id }], skipDuplicates: true });
    ids.push(id);
  }
  console.log(`✓ Phòng: ${ROOMS.map(({ name }) => name).join(', ')}`);
  return ids as [string, string];
}

async function seedStudents() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const ids: string[] = [];
  for (const [index, [fullName, gender]] of PEOPLE.entries()) {
    const number = String(index + 37).padStart(2, '0');
    const profile = {
      fitnessGoals: pick(GOALS),
      healthNotes: index % 4 === 1 ? pick(HEALTH) : null,
      emergencyContact: `${pick(['Bố', 'Mẹ', 'Vợ', 'Chồng'])} - 09${between(10, 99)}${between(100000, 999999)}`,
    };
    const { id } = await prisma.account.upsert({
      where: { email: `hocvien${number}@sportscenter.local` },
      update: { memberProfile: { update: profile } },
      create: {
        email: `hocvien${number}@sportscenter.local`,
        fullName,
        gender,
        phone: `0919${String(index + 37).padStart(6, '0')}`,
        dateOfBirth: new Date(Date.UTC(between(1980, 2005), between(0, 11), between(1, 28))),
        role: 'MEMBER',
        roles: ['MEMBER'],
        passwordHash,
        emailVerifiedAt: new Date(),
        memberProfile: { create: profile },
      },
      select: { id: true },
    });
    ids.push(id);
  }
  console.log(
    `✓ ${ids.length} học viên (hocvien37–${36 + PEOPLE.length}@sportscenter.local), mật khẩu ${DEMO_PASSWORD}`,
  );
  return ids;
}

async function seedCourses() {
  const [gym, swim] = await Promise.all([
    prisma.sport.findFirstOrThrow({ where: { name: 'Gym' }, select: { id: true } }),
    prisma.sport.findFirstOrThrow({ where: { name: 'Bơi lội' }, select: { id: true } }),
  ]);
  await prisma.course.upsert({
    where: { id: COURSE_FITNESS_ID },
    update: {},
    create: {
      id: COURSE_FITNESS_ID,
      name: 'Thể lực Tổng hợp',
      sportId: gym.id,
      price: 1_000_000,
      totalSessions: 12,
      description: 'Sức bền, sức mạnh và core cho người mới tập.',
    },
  });
  await prisma.course.upsert({
    where: { id: COURSE_SWIM_ID },
    update: {},
    create: {
      id: COURSE_SWIM_ID,
      name: 'Bơi Cơ bản Người lớn',
      sportId: swim.id,
      price: 1_100_000,
      totalSessions: 10,
      description: 'Làm quen nước, nổi, thở và bơi ếch cơ bản.',
    },
  });
}

/** Rebuilds a class from scratch: sessions on `dates`, `students` enrolled before the first one. */
async function rebuildClass(input: {
  id: string;
  name: string;
  courseId: string;
  facilityId: string;
  coachId: string;
  managerId: string;
  maxStudents: number;
  weeklySchedule: Slot[];
  sessions: { date: string; slot: Slot }[];
  students: string[];
}) {
  const { id, sessions, students } = input;
  const where = { session: { classId: id } } satisfies Prisma.ClassAttendanceWhereInput;
  await prisma.memberEvaluation.deleteMany({ where });
  await prisma.classAttendance.deleteMany({ where });
  await prisma.progressReview.deleteMany({ where: { classId: id } });
  await prisma.classSession.deleteMany({ where: { classId: id } });

  const data = {
    name: input.name,
    courseId: input.courseId,
    facilityId: input.facilityId,
    coachId: input.coachId,
    minStudents: 2,
    maxStudents: input.maxStudents,
    weeklySchedule: input.weeklySchedule,
    status: 'OPEN' as const,
    startDate: new Date(sessions[0]!.date),
    endDate: new Date(sessions.at(-1)!.date),
    approvedById: input.managerId,
    approvedAt: new Date(),
  };
  await prisma.class.upsert({ where: { id }, update: data, create: { id, ...data } });

  const course = await prisma.course.findUniqueOrThrow({ where: { id: input.courseId }, select: { price: true } });
  const enrolledAt = new Date(`${addDays(sessions[0]!.date, -3)}T03:00:00Z`);
  for (const accountId of students) {
    const enrolled = await prisma.classEnrollment.findFirst({ where: { classId: id, accountId, status: 'ENROLLED' } });
    if (enrolled) {
      await prisma.classEnrollment.update({ where: { id: enrolled.id }, data: { enrolledAt } });
      continue;
    }
    const price = Number(course.price);
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-AI-${id.slice(-2)}-${accountId.slice(0, 8).toUpperCase()}`,
        idempotencyKey: `seed:coach-ai:enroll:${id}:${accountId}`,
        accountId,
        receiptSnapshot: { schema_version: 1 },
        subtotal: price,
        totalAmount: price,
        paymentMethod: 'CASH',
        createdAt: enrolledAt,
        items: {
          create: {
            lineNumber: 1,
            type: 'COURSE_ENROLLMENT',
            itemSnapshot: { schema_version: 1, className: input.name },
            subtotal: price,
            totalAmount: price,
          },
        },
      },
      select: { items: { select: { id: true } } },
    });
    await prisma.classEnrollment.create({
      data: { classId: id, accountId, orderItemId: order.items[0]!.id, enrolledAt },
    });
  }

  const created: { id: string; date: string; slot: Slot }[] = [];
  for (const [index, { date, slot }] of sessions.entries()) {
    const session = await prisma.classSession.create({
      data: {
        classId: id,
        facilityId: input.facilityId,
        coachId: input.coachId,
        sessionNumber: index + 1,
        sessionDate: new Date(date),
        startTime: toDbTime(parseTime(slot.startTime)),
        endTime: toDbTime(parseTime(slot.endTime)),
      },
      select: { id: true },
    });
    created.push({ id: session.id, date, slot });
  }
  return created;
}

async function main() {
  const manager = await prisma.account.findFirst({ where: { roles: { has: 'MANAGER' } }, select: { id: true } });
  const coach = await prisma.account.findUnique({
    where: { email: 'coach1@sportscenter.local' },
    select: { id: true },
  });
  if (!manager || !coach) throw new Error('Chạy bun run db:seed:demo trước.');

  const [fitnessRoom, poolRoom] = await seedRooms();
  const students = await seedStudents();
  await seedCourses();

  const today = todayInCenter();
  const now = minutesInCenter();
  // Today's session started about 45 minutes ago, so attendance is open now; kept inside 06:00–22:00.
  const todayStart = Math.min(Math.max(Math.floor((now - 45) / 30) * 30, 6 * 60), 20 * 60 + 30);
  const todaySlot: Slot = { dayOfWeek: weekdayOf(today), startTime: hhmm(todayStart), endTime: hhmm(todayStart + 90) };
  const eveningSlot = (date: string): Slot => ({ dayOfWeek: weekdayOf(date), startTime: '18:00', endTime: '19:30' });
  // Three sessions a week: today's weekday and the weekdays two and four days earlier.
  const weekly = [todaySlot, eveningSlot(addDays(today, -2)), eveningSlot(addDays(today, -4))];

  // Mid-course: 12 sessions from 16 days ago, today's being number 7 or so.
  const fitnessDates: { date: string; slot: Slot }[] = [];
  for (let day = -16; fitnessDates.length < 12; day++) {
    const date = addDays(today, day);
    const slot = weekly.find(({ dayOfWeek }) => dayOfWeek === weekdayOf(date));
    if (slot) fitnessDates.push({ date, slot });
  }
  const fitnessStudents = students.slice(0, 14);
  const fitness = await rebuildClass({
    id: CLASS_FITNESS_ID,
    name: 'Thể lực Tổng hợp K02',
    courseId: COURSE_FITNESS_ID,
    facilityId: fitnessRoom,
    coachId: coach.id,
    managerId: manager.id,
    maxStudents: 16,
    weeklySchedule: weekly,
    sessions: fitnessDates,
    students: fitnessStudents,
  });

  const nowAt = new Date();
  const past = fitness.filter(({ date, slot }) => toCenterDateTime(date, parseTime(slot.endTime)) <= nowAt);
  // The last two finished sessions are left for the coach (and the assistant) to mark.
  const marked = past.slice(0, -2);
  const reliability = new Map(fitnessStudents.map((id) => [id, pick([0.95, 0.85, 0.75, 0.6])]));
  for (const [index, session] of marked.entries()) {
    const note = NOTES[index % NOTES.length]!;
    await prisma.classSession.update({
      where: { id: session.id },
      data: {
        noteTitle: `Buổi ${index + 1}: ${note[0]}`,
        noteContent: note[1],
        noteHomework: note[2],
        noteUpdatedAt: nowAt,
      },
    });
    for (const accountId of fitnessStudents) {
      const roll = random();
      const rate = reliability.get(accountId)!;
      const status: AttendanceStatus = roll < rate ? 'PRESENT' : roll < rate + 0.1 ? 'LATE' : 'ABSENT';
      await prisma.classAttendance.create({
        data: { sessionId: session.id, accountId, status, updatedById: coach.id },
      });
      if (status === 'ABSENT') continue;
      await prisma.memberEvaluation.create({
        data: { sessionId: session.id, accountId, coachId: coach.id, rating: between(2, 5) },
      });
    }
  }

  // Starts in three days at 07:00 on its two weekdays.
  const swimStart = addDays(today, 3);
  const swimSlots: Slot[] = [
    { dayOfWeek: weekdayOf(swimStart), startTime: '07:00', endTime: '08:30' },
    { dayOfWeek: weekdayOf(addDays(swimStart, 3)), startTime: '07:00', endTime: '08:30' },
  ];
  const swimDates: { date: string; slot: Slot }[] = [];
  for (let day = 0; swimDates.length < 10; day++) {
    const date = addDays(swimStart, day);
    const slot = swimSlots.find(({ dayOfWeek }) => dayOfWeek === weekdayOf(date));
    if (slot) swimDates.push({ date, slot });
  }
  await rebuildClass({
    id: CLASS_SWIM_ID,
    name: 'Bơi Cơ bản Người lớn K05',
    courseId: COURSE_SWIM_ID,
    facilityId: poolRoom,
    coachId: coach.id,
    managerId: manager.id,
    maxStudents: 12,
    weeklySchedule: swimSlots,
    sessions: swimDates,
    students: students.slice(8, 18),
  });

  console.log(
    `✓ Thể lực Tổng hợp K02 (Phòng Thể lực 2): 14 học viên, ${marked.length} buổi đã điểm danh, ` +
      `2 buổi chưa điểm danh, buổi hôm nay ${todaySlot.startTime}–${todaySlot.endTime}`,
  );
  console.log(`✓ Bơi Cơ bản Người lớn K05 (Hồ bơi phụ): 10 học viên, khai giảng ${swimStart} lúc 07:00`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
