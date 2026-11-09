import type { FulfillmentStatus, ListProductSalesQuery, ListProductsQuery } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import { Prisma } from '~/generated/prisma/client';
import { pageArgs } from '~/utils/pagination';
import { unaccentContains } from '~/utils/search';

type Db = Prisma.TransactionClient;

const categorySelect = {
  id: true,
  name: true,
  sortOrder: true,
  isActive: true,
  _count: { select: { products: { where: { deletedAt: null } } } },
} satisfies Prisma.ProductCategorySelect;

const productSelect = {
  id: true,
  sku: true,
  name: true,
  description: true,
  imageUrl: true,
  categoryId: true,
  category: { select: { id: true, name: true, isActive: true } },
  sportId: true,
  sport: { select: { id: true, name: true } },
  price: true,
  stock: true,
  lowStockThreshold: true,
  isActive: true,
} satisfies Prisma.ProductSelect;

const person = { select: { id: true, fullName: true } } as const;

const movementSelect = {
  id: true,
  reason: true,
  delta: true,
  stockAfter: true,
  note: true,
  createdAt: true,
  createdBy: person,
  sale: { select: { orderItem: { select: { order: { select: { orderNumber: true } } } } } },
} satisfies Prisma.StockMovementSelect;

const saleSelect = {
  id: true,
  orderItemId: true,
  quantity: true,
  unitPrice: true,
  status: true,
  pickupDeadline: true,
  pickedUpAt: true,
  cancelledAt: true,
  createdAt: true,
  productId: true,
  product: { select: { id: true, sku: true, name: true, imageUrl: true } },
  pickedUpBy: person,
  orderItem: {
    select: {
      totalAmount: true,
      refundedAt: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          guestName: true,
          guestPhone: true,
          account: { select: { id: true, fullName: true, phone: true } },
        },
      },
    },
  },
} satisfies Prisma.ProductSaleSelect;

export type ProductCategoryRow = Prisma.ProductCategoryGetPayload<{ select: typeof categorySelect }>;
export type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;
export type StockMovementRow = Prisma.StockMovementGetPayload<{ select: typeof movementSelect }>;
export type ProductSaleRow = Prisma.ProductSaleGetPayload<{ select: typeof saleSelect }>;

const visibleProduct = { deletedAt: null, isActive: true, category: { deletedAt: null, isActive: true } };

class ShopRepository {
  // ---- categories ----
  findCategories = (includeInactive: boolean) =>
    prisma.productCategory.findMany({
      where: { deletedAt: null, ...(!includeInactive && { isActive: true }) },
      select: categorySelect,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

  findCategory = (id: string, db: Db = prisma) =>
    db.productCategory.findUnique({ where: { id, deletedAt: null }, select: categorySelect });

  createCategory = (data: Prisma.ProductCategoryCreateInput, db: Db) =>
    db.productCategory.create({ data, select: categorySelect });

  updateCategory = (id: string, data: Prisma.ProductCategoryUpdateInput, db: Db) =>
    db.productCategory.update({ where: { id }, data, select: categorySelect });

  // ---- products ----
  sportExists = async (id: string, db: Db) => (await db.sport.count({ where: { id, deletedAt: null } })) > 0;

  countProductsInCategory = (categoryId: string, db: Db) =>
    db.product.count({ where: { categoryId, deletedAt: null } });

  private idsMatching = async (q: string) => {
    const rows = await prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM products WHERE deleted_at IS NULL AND (${unaccentContains(Prisma.sql`name`, q)} OR sku ILIKE ${`%${q}%`})`,
    );
    return rows.map(({ id }) => id);
  };

  findProductPage = async (
    { q, categoryId, sportId, includeInactive, lowStock, ...page }: ListProductsQuery,
    staffView: boolean,
  ) => {
    const ids = q ? await this.idsMatching(q) : undefined;
    const where: Prisma.ProductWhereInput = {
      ...(includeInactive && staffView ? { deletedAt: null } : visibleProduct),
      ...(ids && { id: { in: ids } }),
      ...(categoryId && { categoryId }),
      ...(sportId && { sportId }),
      ...(lowStock && { stock: { lte: prisma.product.fields.lowStockThreshold } }),
    };
    return Promise.all([
      prisma.product.findMany({
        where,
        select: productSelect,
        orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }, { id: 'asc' }],
        ...pageArgs(page),
      }),
      prisma.product.count({ where }),
    ]);
  };

  findProduct = (id: string, db: Db = prisma) =>
    db.product.findUnique({ where: { id, deletedAt: null }, select: productSelect });

  findVisibleProduct = (id: string, db: Db = prisma) =>
    db.product.findFirst({ where: { id, ...visibleProduct }, select: productSelect });

  createProduct = (data: Prisma.ProductUncheckedCreateInput, db: Db) =>
    db.product.create({ data, select: productSelect });

  updateProduct = (id: string, data: Prisma.ProductUncheckedUpdateInput, db: Db) =>
    db.product.update({ where: { id }, data, select: productSelect });

  /** Applies a stock change only while it keeps stock non-negative; null when it would not. */
  changeStock = async (id: string, delta: number, db: Db) => {
    const { count } = await db.product.updateMany({
      where: { id, ...(delta < 0 && { stock: { gte: -delta } }) },
      data: { stock: { increment: delta } },
    });
    if (count === 0) return null;
    return (await db.product.findUniqueOrThrow({ where: { id }, select: { stock: true } })).stock;
  };

  reservedByProduct = async (productIds: string[], db: Db = prisma) => {
    const rows = await db.productSale.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds }, status: 'PENDING_PICKUP' },
      _sum: { quantity: true },
    });
    return new Map(rows.map(({ productId, _sum }) => [productId, _sum.quantity ?? 0]));
  };

  hasPendingSales = async (productId: string, db: Db) =>
    (await db.productSale.count({ where: { productId, status: 'PENDING_PICKUP' } })) > 0;

  // ---- stock ledger ----
  createMovement = (data: Prisma.StockMovementUncheckedCreateInput, db: Db) =>
    db.stockMovement.create({ data, select: movementSelect });

  findMovements = (productId: string, page: { page: number; limit: number }) => {
    const where = { productId };
    return Promise.all([
      prisma.stockMovement.findMany({
        where,
        select: movementSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(page),
      }),
      prisma.stockMovement.count({ where }),
    ]);
  };

  // ---- sales ----
  createSale = (data: Prisma.ProductSaleUncheckedCreateInput, db: Db) =>
    db.productSale.create({ data, select: { id: true } });

  findSale = (id: string, db: Db = prisma) => db.productSale.findUnique({ where: { id }, select: saleSelect });

  findSalePage = async ({ q, status, ...page }: ListProductSalesQuery) => {
    const text = q?.trim();
    const where: Prisma.ProductSaleWhereInput = {
      ...(status && { status }),
      ...(text && {
        OR: [
          { orderItem: { order: { orderNumber: { contains: text, mode: 'insensitive' } } } },
          { orderItem: { order: { account: { fullName: { contains: text, mode: 'insensitive' } } } } },
          { orderItem: { order: { account: { phone: { contains: text } } } } },
          { orderItem: { order: { guestName: { contains: text, mode: 'insensitive' } } } },
          { orderItem: { order: { guestPhone: { contains: text } } } },
          { product: { name: { contains: text, mode: 'insensitive' } } },
          { product: { sku: { contains: text, mode: 'insensitive' } } },
        ],
      }),
    };
    // Pending pickups closest to their deadline come first; history is newest first.
    const orderBy: Prisma.ProductSaleOrderByWithRelationInput[] =
      status === 'PENDING_PICKUP'
        ? [{ pickupDeadline: 'asc' }, { id: 'asc' }]
        : [{ createdAt: 'desc' }, { id: 'desc' }];
    return Promise.all([
      prisma.productSale.findMany({ where, select: saleSelect, orderBy, ...pageArgs(page) }),
      prisma.productSale.count({ where }),
    ]);
  };

  updateSaleStatus = (id: string, from: FulfillmentStatus, data: Prisma.ProductSaleUncheckedUpdateManyInput, db: Db) =>
    db.productSale.updateMany({ where: { id, status: from }, data });

  findExpiredSaleIds = (now: Date, take: number) =>
    prisma.productSale.findMany({
      where: { status: 'PENDING_PICKUP', pickupDeadline: { lt: now } },
      select: { id: true },
      orderBy: { pickupDeadline: 'asc' },
      take,
    });

  countExpiredSales = (now: Date) =>
    prisma.productSale.count({ where: { status: 'PENDING_PICKUP', pickupDeadline: { lt: now } } });

  findSalesDueBefore = (now: Date, until: Date) =>
    prisma.productSale.findMany({
      where: { status: 'PENDING_PICKUP', pickupDeadline: { gte: now, lte: until } },
      select: saleSelect,
    });

  // ---- report ----
  findSoldLines = (from: Date, to: Date) =>
    prisma.productSale.findMany({
      where: { status: { not: 'CANCELLED' }, createdAt: { gte: from, lt: to } },
      select: {
        quantity: true,
        orderItem: { select: { totalAmount: true, orderId: true } },
        product: { select: { id: true, sku: true, name: true, category: { select: { id: true, name: true } } } },
      },
    });

  findLowStock = () =>
    prisma.product.findMany({
      where: { ...visibleProduct, stock: { lte: prisma.product.fields.lowStockThreshold } },
      select: { id: true, sku: true, name: true, stock: true, lowStockThreshold: true },
      orderBy: [{ stock: 'asc' }, { name: 'asc' }],
      take: 20,
    });

  countPendingPickups = () => prisma.productSale.count({ where: { status: 'PENDING_PICKUP' } });
}

export default new ShopRepository();
