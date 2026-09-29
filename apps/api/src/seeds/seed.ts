import { prisma } from '~/configs/db';
import type { FacilityType, Prisma, Role } from '~/generated/prisma/client';
import { hashPassword } from '~/utils/password';

const MANAGER_EMAIL = 'manager@sportscenter.local';
const MANAGER_PASSWORD = 'Manager@123';
const MANAGER_FULL_NAME = 'Quản lý trung tâm';

const DEMO_PASSWORD = 'Demo@1234';

const DEMO_SPORTS = [
  { name: 'Bơi lội', description: 'Bơi tự do, bơi ếch cho mọi lứa tuổi' },
  { name: 'Cầu lông', description: 'Sân cầu lông tiêu chuẩn thi đấu' },
  { name: 'Bóng đá', description: 'Bóng đá sân 5 và sân 7' },
  { name: 'Yoga', description: 'Yoga cơ bản và nâng cao' },
  { name: 'Gym', description: 'Tập tạ và máy tập thể hình' },
];

const DEMO_FACILITIES: {
  name: string;
  type: FacilityType;
  capacityPerSlot: number;
  pricePerSlot: number;
  sports: string[];
}[] = [
  { name: 'Hồ bơi trong nhà', type: 'ROOM', capacityPerSlot: 30, pricePerSlot: 60000, sports: ['Bơi lội'] },
  { name: 'Sân cầu lông 1', type: 'COURT', capacityPerSlot: 4, pricePerSlot: 80000, sports: ['Cầu lông'] },
  { name: 'Sân cầu lông 2', type: 'COURT', capacityPerSlot: 4, pricePerSlot: 80000, sports: ['Cầu lông'] },
  { name: 'Sân bóng đá mini', type: 'FIELD', capacityPerSlot: 14, pricePerSlot: 300000, sports: ['Bóng đá'] },
  { name: 'Phòng Yoga', type: 'ROOM', capacityPerSlot: 20, pricePerSlot: 50000, sports: ['Yoga'] },
  { name: 'Phòng Gym', type: 'GYM', capacityPerSlot: 40, pricePerSlot: 40000, sports: ['Gym'] },
];

const MEMBERSHIPS = [
  {
    name: 'Gói Cơ bản 1 tháng',
    description: 'Vào phòng gym không giới hạn trong 30 ngày',
    price: 300000,
    durationDays: 30,
    gymAccess: true,
  },
  {
    name: 'Gói Tiêu chuẩn 3 tháng',
    description: 'Vào phòng gym, giảm 10% đặt sân và 5% khóa học',
    price: 800000,
    durationDays: 90,
    gymAccess: true,
    bookingDiscountPct: 10,
    classDiscountPct: 5,
    freeBookingSlotsPerMonth: 2,
  },
  {
    name: 'Gói Cao cấp 12 tháng',
    description: 'Vào phòng gym, giảm 20% đặt sân và 15% khóa học',
    price: 2800000,
    durationDays: 365,
    gymAccess: true,
    bookingDiscountPct: 20,
    classDiscountPct: 15,
    freeBookingSlotsPerMonth: 4,
  },
] satisfies (Omit<Prisma.MembershipCreateInput, 'price'> & { price: number })[];

const DEMO_ACCOUNTS: {
  email: string;
  fullName: string;
  phone: string;
  role: Exclude<Role, 'MANAGER'>;
  sports?: string[];
  walletBalance?: number;
}[] = [
  {
    email: 'coach1@sportscenter.local',
    fullName: 'Trần Văn Huấn',
    phone: '0901000001',
    role: 'COACH',
    sports: ['Bơi lội', 'Gym'],
  },
  { email: 'coach2@sportscenter.local', fullName: 'Lê Thị Mai', phone: '0901000002', role: 'COACH', sports: ['Yoga'] },
  {
    email: 'coach3@sportscenter.local',
    fullName: 'Phạm Minh Tuấn',
    phone: '0901000003',
    role: 'COACH',
    sports: ['Cầu lông', 'Bóng đá'],
  },
  { email: 'reception1@sportscenter.local', fullName: 'Nguyễn Thu Hà', phone: '0902000001', role: 'RECEPTIONIST' },
  { email: 'reception2@sportscenter.local', fullName: 'Đỗ Quang Vinh', phone: '0902000002', role: 'RECEPTIONIST' },
  {
    email: 'member1@sportscenter.local',
    fullName: 'Hoàng Anh Thư',
    phone: '0903000001',
    role: 'MEMBER',
    walletBalance: 500000,
  },
  {
    email: 'member2@sportscenter.local',
    fullName: 'Vũ Đức Long',
    phone: '0903000002',
    role: 'MEMBER',
    walletBalance: 1500000,
  },
  {
    email: 'member3@sportscenter.local',
    fullName: 'Bùi Ngọc Lan',
    phone: '0903000003',
    role: 'MEMBER',
    walletBalance: 0,
  },
];

const PROFILE_CREATE = {
  COACH: { coachProfile: { create: {} } },
  RECEPTIONIST: { receptionistProfile: { create: {} } },
  MEMBER: { memberProfile: { create: {} } },
} satisfies Record<Exclude<Role, 'MANAGER'>, Partial<Prisma.AccountCreateInput>>;

async function seedManager() {
  const passwordHash = await hashPassword(MANAGER_PASSWORD);
  const manager = await prisma.account.upsert({
    where: { email: MANAGER_EMAIL },
    update: {},
    create: {
      email: MANAGER_EMAIL,
      fullName: MANAGER_FULL_NAME,
      passwordHash,
      role: 'MANAGER',
      emailVerifiedAt: new Date(),
      managerProfile: { create: {} },
    },
  });
  console.warn(`✓ MANAGER ${MANAGER_EMAIL} / ${MANAGER_PASSWORD}`);
  return manager;
}

async function seedSettings() {
  await prisma.systemSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  console.warn('✓ system_settings (id = 1)');
}

async function seedSports() {
  const ids = new Map<string, string>();
  for (const sport of DEMO_SPORTS) {
    const existing = await prisma.sport.findFirst({
      where: { name: sport.name, deletedAt: null },
      select: { id: true },
    });
    const { id } = existing ?? (await prisma.sport.create({ data: sport, select: { id: true } }));
    ids.set(sport.name, id);
  }
  console.warn(`✓ ${ids.size} bộ môn`);
  return ids;
}

async function seedFacilities(sportIds: Map<string, string>) {
  for (const { sports, ...facility } of DEMO_FACILITIES) {
    const existing = await prisma.facility.findFirst({
      where: { name: facility.name, deletedAt: null },
      select: { id: true },
    });
    const { id } = existing ?? (await prisma.facility.create({ data: facility, select: { id: true } }));
    await prisma.facilitySport.createMany({
      data: sports.map((name) => ({ facilityId: id, sportId: sportIds.get(name)! })),
      skipDuplicates: true,
    });
  }
  console.warn(`✓ ${DEMO_FACILITIES.length} cơ sở vật chất`);
}

async function seedMemberships() {
  for (const membership of MEMBERSHIPS) {
    const exists = await prisma.membership.count({ where: { name: membership.name, deletedAt: null } });
    if (!exists) await prisma.membership.create({ data: membership });
  }
  console.warn(`✓ ${MEMBERSHIPS.length} gói thành viên`);
}

async function seedAccounts(managerId: string, sportIds: Map<string, string>) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const { sports = [], walletBalance = 0, ...account } of DEMO_ACCOUNTS) {
    const { id } = await prisma.account.upsert({
      where: { email: account.email },
      update: {},
      create: { ...account, passwordHash, emailVerifiedAt: new Date(), ...PROFILE_CREATE[account.role] },
      select: { id: true },
    });

    for (const sportName of sports) {
      const sportId = sportIds.get(sportName)!;
      const exists = await prisma.coachSpecialization.count({
        where: { coachId: id, sportId, status: { in: ['PENDING', 'APPROVED'] } },
      });
      if (!exists) {
        await prisma.coachSpecialization.create({
          data: { coachId: id, sportId, status: 'APPROVED', reviewedById: managerId, reviewedAt: new Date() },
        });
      }
    }

    if (walletBalance > 0) await seedWalletTopUp(id, managerId, walletBalance);
  }
  console.warn(`✓ ${DEMO_ACCOUNTS.length} tài khoản demo, mật khẩu chung ${DEMO_PASSWORD}`);
}

async function seedWalletTopUp(accountId: string, managerId: string, amount: number) {
  const idempotencyKey = `seed:top-up:${accountId}`;
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
        transactionCode: `SEED-${accountId.slice(0, 8).toUpperCase()}`,
        idempotencyKey,
        type: 'TOP_UP',
        topUpMethod: 'CASH',
        amount,
        balanceAfter: walletBalance,
        createdById: managerId,
        description: 'Số dư ban đầu (dữ liệu demo)',
      },
    });
  });
}

async function main() {
  const demo = process.argv.includes('--demo');

  await seedSettings();
  const manager = await seedManager();

  if (demo) {
    const sportIds = await seedSports();
    await seedFacilities(sportIds);
    await seedMemberships();
    await seedAccounts(manager.id, sportIds);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
