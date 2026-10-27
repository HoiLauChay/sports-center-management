/* eslint-disable no-console */
/**
 * Realistic students for coach1's two running classes (Bơi Sải K03, Gym K01):
 * ~36 members with full profiles, classes rewound to mid-course, and every past session given
 * attendance, results and notes, plus mid-course reviews. Needs db:seed:demo and seed-coach-full first.
 * Re-runnable: members are upserted, the two classes' sessions and training data are rebuilt each run.
 */
import { prisma } from '~/configs/db';
import type { AttendanceStatus, Gender, Prisma } from '~/generated/prisma/client';
import { hashPassword } from '~/utils/password';
import { addDays, parseTime, toCenterDateTime, toDbTime, todayInCenter } from '~/utils/time';

const DEMO_PASSWORD = 'Demo@1234';
const CLASS_SWIM_ID = 'c1000000-0000-4000-8000-000000000012';
const CLASS_GYM_ID = 'c1000000-0000-4000-8000-000000000014';
/** The classes started this many days ago, so about half of the course is behind them. */
const STARTED_DAYS_AGO = 21;

/** Deterministic randomness: every run produces the same people and the same results. */
const random = (() => {
  let seed = 20261027;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();
const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]!;
const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
const chance = (p: number) => random() < p;

const PEOPLE: [string, Gender][] = [
  ['Nguyễn Minh Anh', 'FEMALE'],
  ['Trần Quốc Bảo', 'MALE'],
  ['Lê Thị Bích Ngọc', 'FEMALE'],
  ['Phạm Đức Duy', 'MALE'],
  ['Hoàng Gia Hân', 'FEMALE'],
  ['Vũ Thành Long', 'MALE'],
  ['Đặng Khánh Linh', 'FEMALE'],
  ['Bùi Hoàng Nam', 'MALE'],
  ['Đỗ Phương Thảo', 'FEMALE'],
  ['Ngô Tuấn Kiệt', 'MALE'],
  ['Dương Mỹ Duyên', 'FEMALE'],
  ['Lý Hải Đăng', 'MALE'],
  ['Phan Thu Trang', 'FEMALE'],
  ['Trịnh Văn Hùng', 'MALE'],
  ['Mai Ngọc Hà', 'FEMALE'],
  ['Hồ Quang Huy', 'MALE'],
  ['Châu Bảo Trâm', 'FEMALE'],
  ['Tô Minh Khoa', 'MALE'],
  ['Lương Thanh Hương', 'FEMALE'],
  ['Cao Đình Phúc', 'MALE'],
  ['Tạ Diệu Linh', 'FEMALE'],
  ['Huỳnh Nhật Minh', 'MALE'],
  ['Kiều Lan Chi', 'FEMALE'],
  ['Đinh Công Thắng', 'MALE'],
  ['Quách Ánh Dương', 'FEMALE'],
  ['La Trung Kiên', 'MALE'],
  ['Văn Thị Hồng Nhung', 'FEMALE'],
  ['Thái Bá Lộc', 'MALE'],
  ['Âu Cẩm Tú', 'FEMALE'],
  ['Từ Đức Mạnh', 'MALE'],
  ['Giang Thùy Dung', 'FEMALE'],
  ['Lâm Chí Thanh', 'MALE'],
  ['Ninh Khả Hân', 'FEMALE'],
  ['Mạc Văn Tài', 'MALE'],
  ['Ông Thị Yến', 'FEMALE'],
  ['Triệu Gia Bảo', 'MALE'],
];

const GOALS = {
  swim: [
    'Bơi sải liên tục 400m không nghỉ',
    'Cải thiện kỹ thuật thở 2 bên khi bơi sải',
    'Giảm thời gian bơi 100m xuống dưới 2 phút',
    'Bơi được 1km để chuẩn bị thi ba môn phối hợp',
    'Hết sợ nước sâu, tự tin bơi ở hồ 2m',
    'Bơi để phục hồi sau chấn thương đầu gối',
    'Giữ dáng, tăng sức bền tim phổi',
  ],
  gym: [
    'Giảm 6kg mỡ trong 3 tháng',
    'Tăng 4kg cơ, đặc biệt nhóm cơ ngực và lưng',
    'Squat được 80kg đúng kỹ thuật',
    'Cải thiện tư thế, giảm đau lưng do ngồi văn phòng',
    'Siết cơ bụng, giảm vòng eo 5cm',
    'Tăng sức mạnh tổng thể để chơi bóng đá tốt hơn',
    'Duy trì thể lực, tập đều 3 buổi/tuần',
  ],
} as const;

const HEALTH = [
  'Hen suyễn nhẹ, mang theo bình xịt',
  'Từng chấn thương dây chằng gối trái (2024)',
  'Thoát vị đĩa đệm L4-L5 nhẹ, tránh tải nặng cột sống',
  'Huyết áp hơi cao, đang theo dõi',
  'Đau vai phải khi giơ tay cao',
  'Viêm xoang, hạn chế lặn lâu',
  'Tiểu đường type 2, kiểm soát bằng thuốc',
] as const;

const COMMENTS = {
  swim: {
    low: ['Thở sai nhịp, hay ngóc đầu lên', 'Chân đạp chưa đều, người chìm', 'Mất sức sau 50m, cần tăng sức bền'],
    mid: ['Tay quạt ổn, cần duỗi dài hơn', 'Nhịp thở đều hơn buổi trước', 'Xoay người chưa đủ khi lấy hơi'],
    high: ['Kỹ thuật tốt, bơi 200m liên tục', 'Quay vòng đẹp, giữ nhịp ổn định', 'Tiến bộ rõ, sẵn sàng tăng cự ly'],
  },
  gym: {
    low: ['Squat còn gù lưng, giảm tạ', 'Chưa giữ core khi deadlift', 'Nghỉ giữa hiệp quá lâu'],
    mid: [
      'Form bench press ổn, tăng 2.5kg được',
      'Hoàn thành đủ hiệp, cần siết chậm hơn',
      'Tư thế tốt hơn, còn hơi vội',
    ],
    high: ['Form chuẩn, tăng tạ buổi sau', 'Hoàn thành superset tốt', 'Sức bền cải thiện rõ'],
  },
} as const;

const NOTES = {
  swim: [
    ['Khởi động & thở bơi sải', 'Ôn thở 3 nhịp, đập chân với phao.', 'Tập thở trên cạn 10 phút mỗi ngày'],
    ['Kỹ thuật tay sải', 'Tập kéo nước chữ S, duỗi tay tối đa.', 'Xem lại video kỹ thuật tay'],
    ['Phối hợp tay - chân - thở', 'Bơi 4x50m phối hợp, nghỉ 30 giây.', 'Kéo giãn vai 15 phút'],
    ['Sức bền 200m', 'Bơi liên tục 200m, giữ nhịp đều.', 'Chạy bộ nhẹ 20 phút'],
    ['Quay vòng lật', 'Tập quay vòng sát thành hồ.', 'Tập lộn trên thảm'],
    ['Interval 8x25m', 'Bơi nhanh 25m, nghỉ 20 giây.', 'Ngủ đủ giấc trước buổi sau'],
  ],
  gym: [
    ['Làm quen máy & đo chỉ số', 'Đo cân nặng, mỡ, hướng dẫn máy cơ bản.', 'Ghi nhật ký ăn uống 3 ngày'],
    ['Thân dưới: Squat', 'Squat 4x10 với tạ đòn, lunges.', 'Giãn cơ đùi sau'],
    ['Thân trên: Đẩy', 'Bench press, shoulder press 4x8.', 'Uống đủ 2 lít nước/ngày'],
    ['Thân trên: Kéo', 'Lat pulldown, seated row 4x10.', 'Plank 3x45 giây mỗi ngày'],
    ['Deadlift & core', 'Deadlift kỹ thuật, plank, dead bug.', 'Đi bộ 8000 bước/ngày'],
    ['Circuit đốt mỡ', '5 trạm x 3 vòng, nghỉ 1 phút.', 'Ăn đủ đạm'],
  ],
} as const;

type Kind = keyof typeof GOALS;
type Slot = { dayOfWeek: number; startTime: string; endTime: string };

const birthDate = () => new Date(Date.UTC(between(1978, 2006), between(0, 11), between(1, 28)));

async function seedMembers(managerId: string) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const members: { id: string; kind: Kind }[] = [];
  for (const [index, [fullName, gender]] of PEOPLE.entries()) {
    const kind: Kind = index % 2 === 0 ? 'swim' : 'gym';
    const number = String(index + 1).padStart(2, '0');
    const email = `hocvien${number}@sportscenter.local`;
    const profile = {
      fitnessGoals: pick(GOALS[kind]),
      healthNotes: chance(0.3) ? pick(HEALTH) : null,
      emergencyContact: `${pick(['Bố', 'Mẹ', 'Vợ', 'Chồng', 'Anh', 'Chị'])} - 09${between(10, 99)}${between(100000, 999999)}`,
    };
    const { id } = await prisma.account.upsert({
      where: { email },
      update: { memberProfile: { update: profile } },
      create: {
        email,
        fullName,
        gender,
        phone: `0918${String(index + 1).padStart(6, '0')}`,
        dateOfBirth: birthDate(),
        address: `${between(1, 300)} ${pick(['Lê Lợi', 'Nguyễn Huệ', 'Trần Hưng Đạo', 'Hai Bà Trưng', 'Võ Văn Tần'])}, Q.${between(1, 12)}, TP.HCM`,
        role: 'MEMBER',
        roles: ['MEMBER'],
        passwordHash,
        emailVerifiedAt: new Date(),
        memberProfile: { create: profile },
      },
      select: { id: true },
    });
    await seedWallet(id, managerId, between(2, 30) * 100_000);
    members.push({ id, kind });
  }
  console.log(
    `✓ ${members.length} học viên (hocvien01–${PEOPLE.length}@sportscenter.local), mật khẩu ${DEMO_PASSWORD}`,
  );
  return members;
}

async function seedWallet(accountId: string, managerId: string, amount: number) {
  const idempotencyKey = `seed:students:top-up:${accountId}`;
  await prisma.$transaction(async (tx) => {
    if (await tx.walletTransaction.count({ where: { idempotencyKey } })) return;
    const { walletBalance } = await tx.memberProfile.update({
      where: { accountId },
      data: { walletBalance: { increment: amount } },
      select: { walletBalance: true },
    });
    await tx.walletTransaction.create({
      data: {
        accountId,
        transactionCode: `SEEDHV-${accountId.slice(0, 8).toUpperCase()}`,
        idempotencyKey,
        type: 'TOP_UP',
        topUpMethod: 'CASH',
        amount,
        balanceAfter: walletBalance,
        createdById: managerId,
        description: 'Nạp tiền tại quầy (dữ liệu demo)',
      },
    });
  });
}

/** Session dates from `start` following the weekly slots until the course's session count is reached. */
const planSessions = (start: string, slots: Slot[], total: number) => {
  const sessions: { date: string; slot: Slot }[] = [];
  for (let day = 0; sessions.length < total && day < 365; day++) {
    const date = addDays(start, day);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    for (const slot of slots.filter(({ dayOfWeek }) => dayOfWeek === weekday)) {
      if (sessions.length < total) sessions.push({ date, slot });
    }
  }
  return sessions;
};

async function seedClass(classId: string, kind: Kind, pool: string[], coachId: string) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { name: true, facilityId: true, maxStudents: true, weeklySchedule: true, course: true },
  });
  if (!cls) throw new Error(`Không thấy lớp ${classId}. Chạy seed-coach-full.ts trước.`);

  const start = addDays(todayInCenter(), -STARTED_DAYS_AGO);
  const planned = planSessions(start, cls.weeklySchedule as Slot[], cls.course.totalSessions);

  // Rebuild the class's timeline: training data hangs off sessions, so it goes first.
  const oldSessions = { session: { classId } } satisfies Prisma.ClassAttendanceWhereInput;
  await prisma.memberEvaluation.deleteMany({ where: oldSessions });
  await prisma.classAttendance.deleteMany({ where: oldSessions });
  await prisma.progressReview.deleteMany({ where: { classId } });
  await prisma.classSession.deleteMany({ where: { classId } });
  await prisma.class.update({
    where: { id: classId },
    data: { status: 'OPEN', coachId, startDate: new Date(start), endDate: new Date(planned.at(-1)!.date) },
  });

  // Fill the class to one seat short of full; existing students keep their seats.
  const enrolled = await prisma.classEnrollment.findMany({
    where: { classId, status: 'ENROLLED' },
    select: { accountId: true },
  });
  const ids = new Set(enrolled.map(({ accountId }) => accountId));
  const enrolledAt = new Date(`${addDays(start, -between(2, 6))}T03:00:00Z`);
  for (const accountId of pool) {
    if (ids.size >= cls.maxStudents - 1) break;
    if (ids.has(accountId)) continue;
    const price = Number(cls.course.price);
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-HV-${classId.slice(-4)}-${accountId.slice(0, 8).toUpperCase()}`,
        idempotencyKey: `seed:students:enroll:${classId}:${accountId}:${Date.now()}`,
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
            itemSnapshot: { schema_version: 1, className: cls.name },
            subtotal: price,
            totalAmount: price,
          },
        },
      },
      select: { items: { select: { id: true } } },
    });
    await prisma.classEnrollment.create({
      data: { classId, accountId, orderItemId: order.items[0]!.id, enrolledAt },
    });
    ids.add(accountId);
  }
  // Members enrolled by older seeds must have joined before the first session too.
  await prisma.classEnrollment.updateMany({
    where: { classId, status: 'ENROLLED', enrolledAt: { gt: enrolledAt } },
    data: { enrolledAt },
  });
  const students = [...ids];
  // Older demo members never filled in their goals; give them some so every row reads like a real student.
  for (const accountId of students) {
    await prisma.memberProfile.updateMany({
      where: { accountId, fitnessGoals: null },
      data: { fitnessGoals: pick(GOALS[kind]) },
    });
  }

  // Each student has a steady attendance habit and a starting level that improves over the course.
  const profile = new Map(
    students.map((id) => [id, { reliability: pick([0.92, 0.85, 0.75, 0.6]), level: 1.6 + random() * 2 }]),
  );
  const now = new Date();
  let past = 0;
  for (const [index, { date, slot }] of planned.entries()) {
    const startMinutes = parseTime(slot.startTime);
    const happened = toCenterDateTime(date, startMinutes) <= now;
    const note = NOTES[kind][index % NOTES[kind].length]!;
    const session = await prisma.classSession.create({
      data: {
        classId,
        facilityId: cls.facilityId,
        coachId,
        sessionNumber: index + 1,
        sessionDate: new Date(date),
        startTime: toDbTime(startMinutes),
        endTime: toDbTime(parseTime(slot.endTime)),
        ...(happened && {
          noteTitle: `Buổi ${index + 1}: ${note[0]}`,
          noteContent: note[1],
          noteHomework: note[2],
          noteUpdatedAt: now,
        }),
      },
      select: { id: true },
    });
    if (!happened) continue;
    past++;

    for (const accountId of students) {
      const habit = profile.get(accountId)!;
      const roll = random();
      const status: AttendanceStatus =
        roll < habit.reliability ? 'PRESENT' : roll < habit.reliability + 0.12 ? 'LATE' : 'ABSENT';
      await prisma.classAttendance.create({
        data: {
          sessionId: session.id,
          accountId,
          status,
          note:
            status === 'LATE'
              ? pick(['Kẹt xe', 'Tan làm muộn', 'Đến trễ 10 phút'])
              : status === 'ABSENT'
                ? pick(['Báo ốm', 'Đi công tác', 'Không báo trước', 'Bận việc gia đình'])
                : null,
          updatedById: coachId,
        },
      });
      if (status === 'ABSENT') continue;
      habit.level += 0.15 + (random() - 0.4) * 0.3;
      const rating = Math.max(1, Math.min(5, Math.round(habit.level + (random() - 0.5))));
      const band = rating <= 2 ? 'low' : rating === 3 ? 'mid' : 'high';
      await prisma.memberEvaluation.create({
        data: {
          sessionId: session.id,
          accountId,
          coachId,
          rating,
          comment: chance(0.75) ? pick(COMMENTS[kind][band]) : null,
        },
      });
    }
  }

  // Mid-course reviews once half the course is behind; a few left for the coach to write.
  let reviews = 0;
  if (past >= Math.ceil(planned.length / 2)) {
    for (const accountId of students.slice(0, Math.ceil(students.length * 0.6))) {
      const level = profile.get(accountId)!.level;
      const score = (offset: number) => Math.max(1, Math.min(5, Math.round(level + offset)));
      await prisma.progressReview.create({
        data: {
          classId,
          accountId,
          coachId,
          milestone: 'MID',
          technique: score(random() - 0.5),
          fitness: score(random() - 0.3),
          attitude: score(0.8),
          comment: pick([
            'Tiến bộ đều, cần duy trì đi học đầy đủ.',
            'Kỹ thuật cải thiện rõ so với đầu khóa. Nửa sau tập trung sức bền.',
            'Còn vắng nhiều buổi, ảnh hưởng tiến độ. Cần sắp xếp thời gian.',
            'Thái độ tích cực, tiếp thu nhanh. Có thể tăng cường độ.',
          ]),
        },
      });
      reviews++;
    }
  }
  console.log(
    `✓ ${cls.name}: ${students.length}/${cls.maxStudents} học viên, đã học ${past}/${planned.length} buổi, ${reviews} đánh giá giữa khóa`,
  );
}

async function main() {
  const manager = await prisma.account.findFirst({ where: { roles: { has: 'MANAGER' } }, select: { id: true } });
  const coach = await prisma.account.findUnique({
    where: { email: 'coach1@sportscenter.local' },
    select: { id: true },
  });
  if (!manager || !coach) throw new Error('Chạy bun run db:seed:demo và seed-coach-full.ts trước.');

  const members = await seedMembers(manager.id);
  const of = (kind: Kind) => members.filter((member) => member.kind === kind).map(({ id }) => id);
  await seedClass(CLASS_SWIM_ID, 'swim', of('swim'), coach.id);
  await seedClass(CLASS_GYM_ID, 'gym', of('gym'), coach.id);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
