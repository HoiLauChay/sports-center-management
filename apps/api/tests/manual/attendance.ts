import { prisma } from '~/configs/db';
import { hashPassword } from '~/utils/password';
import { setupAttendance } from '../helpers/attendance';
import { resetDatabase } from '../helpers/db';

// This deliberately resets only a *_test database; the shared guard refuses development/production.
await resetDatabase();
const fixture = await setupAttendance();
const password = 'Attendance175!Test';
const accounts = [fixture.manager, fixture.coach, fixture.otherCoach, fixture.member, fixture.second, fixture.outsider];
await prisma.account.updateMany({
  where: { id: { in: accounts.map(({ id }) => id) } },
  data: { passwordHash: await hashPassword(password), emailVerifiedAt: new Date() },
});
process.stdout.write(
  JSON.stringify(
    {
      password,
      accounts: accounts.map(({ id, email, role }) => ({ id, email, role })),
      classId: fixture.cls.id,
      sessionId: fixture.session.id,
      memberId: fixture.member.id,
      secondMemberId: fixture.second.id,
      outsiderId: fixture.outsider.id,
    },
    null,
    2,
  ) + '\n',
);
await prisma.$disconnect();
