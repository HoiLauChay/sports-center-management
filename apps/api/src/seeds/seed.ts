import { prisma } from '~/configs/db';
import { hashPassword } from '~/utils/password';

const MANAGER_EMAIL = 'manager@sportscenter.local';
const MANAGER_PASSWORD = 'Manager@123';

async function main() {
  const passwordHash = await hashPassword(MANAGER_PASSWORD);

  await prisma.user.upsert({
    where: { email: MANAGER_EMAIL },
    update: {},
    create: { email: MANAGER_EMAIL, passwordHash, role: 'MANAGER', emailVerifiedAt: new Date() },
  });

  console.warn(`✓ Seeded MANAGER ${MANAGER_EMAIL} / ${MANAGER_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
