import type { ListFacilitiesQuery } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

const facilitySelect = {
  id: true,
  name: true,
  type: true,
  description: true,
  capacityPerSlot: true,
  pricePerSlot: true,
  isActive: true,
  sports: {
    where: { sport: { deletedAt: null } },
    select: { sport: { select: { id: true, name: true } } },
    orderBy: { sport: { name: 'asc' } },
  },
} satisfies Prisma.FacilitySelect;

export type FacilityRow = Prisma.FacilityGetPayload<{ select: typeof facilitySelect }>;

class FacilityRepository {
  findAll = ({ type, sportId, isActive }: ListFacilitiesQuery) =>
    prisma.facility.findMany({
      where: {
        deletedAt: null,
        type,
        isActive,
        ...(sportId && { sports: { some: { sportId, sport: { deletedAt: null } } } }),
      },
      select: facilitySelect,
      orderBy: { name: 'asc' },
    });

  findById = (id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.facility.findUnique({ where: { id, deletedAt: null }, select: facilitySelect });

  findSportIds = async (facilityId: string, tx: Prisma.TransactionClient = prisma) =>
    (await tx.facilitySport.findMany({ where: { facilityId }, select: { sportId: true } })).map(
      ({ sportId }) => sportId,
    );

  create = (data: Prisma.FacilityCreateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.facility.create({ data, select: facilitySelect });

  update = (id: string, data: Prisma.FacilityUpdateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.facility.update({ where: { id }, data, select: facilitySelect });

  replaceSports = async (
    facilityId: string,
    { added, removed }: { added: string[]; removed: string[] },
    tx: Prisma.TransactionClient = prisma,
  ) => {
    if (removed.length > 0) {
      await tx.facilitySport.deleteMany({ where: { facilityId, sportId: { in: removed } } });
    }
    if (added.length > 0) {
      await tx.facilitySport.createMany({ data: added.map((sportId) => ({ facilityId, sportId })) });
    }
  };
}

export default new FacilityRepository();
