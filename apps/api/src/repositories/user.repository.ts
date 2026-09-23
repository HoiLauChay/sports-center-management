import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

export const publicUserSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  dateOfBirth: true,
  gender: true,
  avatarUrl: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

class UserRepository {
  findById = (id: string) => prisma.user.findUnique({ where: { id }, select: publicUserSelect });

  findFullById = (id: string) => prisma.user.findUnique({ where: { id } });

  findByEmail = (email: string) => prisma.user.findUnique({ where: { email } });

  existsByEmail = async (email: string) => (await prisma.user.count({ where: { email } })) > 0;

  findAuthStateById = (id: string) =>
    prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, status: true, passwordChangedAt: true },
    });

  create = (data: Prisma.UserCreateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.user.create({ data, select: publicUserSelect });

  updatePassword = (id: string, passwordHash: string, tx: Prisma.TransactionClient = prisma) =>
    tx.user.update({
      where: { id },
      data: { passwordHash, passwordChangedAt: new Date() },
      select: publicUserSelect,
    });
}

export default new UserRepository();
