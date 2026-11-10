import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

const coachPublicSelect = {
  id: true,
  fullName: true,
  avatarUrl: true,
  coverImageUrl: true,
  coachProfile: { select: { bio: true, experience: true, certifications: true } },
  specializations: {
    where: { status: 'APPROVED', sport: { deletedAt: null } },
    orderBy: { sport: { name: 'asc' } },
    select: { experienceYears: true, sport: { select: { id: true, name: true, iconUrl: true } } },
  },
} satisfies Prisma.AccountSelect;

export type CoachPublicRow = Prisma.AccountGetPayload<{ select: typeof coachPublicSelect }>;

class CoachRepository {
  findPublic = (id: string) =>
    prisma.account.findFirst({ where: { id, roles: { has: 'COACH' }, status: 'ACTIVE' }, select: coachPublicSelect });
}

export default new CoachRepository();
