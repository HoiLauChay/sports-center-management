import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

const couponSelect = {
  id: true,
  code: true,
  name: true,
  discountType: true,
  discountValue: true,
  maxDiscount: true,
  minOrderAmount: true,
  maxUses: true,
  maxUsesPerUser: true,
  applicableTypes: true,
  validFrom: true,
  validTo: true,
  isActive: true,
  _count: { select: { orders: true } },
} satisfies Prisma.CouponSelect;

export type CouponRow = Prisma.CouponGetPayload<{ select: typeof couponSelect }>;

class CouponRepository {
  findAll = () =>
    prisma.coupon.findMany({ where: { deletedAt: null }, select: couponSelect, orderBy: { createdAt: 'desc' } });

  findById = (id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.coupon.findUnique({ where: { id, deletedAt: null }, select: couponSelect });

  findByCode = (code: string, tx: Prisma.TransactionClient = prisma) =>
    tx.coupon.findFirst({ where: { code, deletedAt: null }, select: couponSelect });

  countUses = async (couponId: string, accountId: string, tx: Prisma.TransactionClient = prisma) => {
    const total = await tx.order.count({ where: { couponId } });
    const mine = await tx.order.count({ where: { couponId, accountId } });
    return [total, mine] as const;
  };

  create = (data: Prisma.CouponCreateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.coupon.create({ data, select: couponSelect });

  update = (id: string, data: Prisma.CouponUpdateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.coupon.update({ where: { id }, data, select: couponSelect });
}

export default new CouponRepository();
