import { prisma } from '~/configs/db';
import { hashPassword } from '~/utils/password';

const MANAGER_EMAIL = 'manager@sportscenter.local';
const MANAGER_PASSWORD = 'Manager@123';
const MANAGER_FULL_NAME = 'Quản lý trung tâm';

async function main() {
  const passwordHash = await hashPassword(MANAGER_PASSWORD);

  await prisma.account.upsert({
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

  console.warn(`✓ Seeded MANAGER ${MANAGER_EMAIL} / ${MANAGER_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
