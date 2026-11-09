/* eslint-disable no-console */
/**
 * Fills the shop with demo categories and products: drinks, gear per sport and accessories.
 * Products are matched to sports by name (badminton, football, ...) when such sports exist.
 * Re-runnable: rows have fixed ids; existing products keep their stock and ledger.
 */
import { createHash } from 'node:crypto';

import { prisma } from '~/configs/db';

const KEY_PREFIX = 'seed:shop:';

const idOf = (key: string) => {
  const hex = createHash('sha1')
    .update(KEY_PREFIX + key)
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

const CATEGORIES = [
  { key: 'drinks', name: 'Đồ uống', sortOrder: 1 },
  { key: 'gear', name: 'Dụng cụ', sortOrder: 2 },
  { key: 'apparel', name: 'Trang phục & phụ kiện', sortOrder: 3 },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]['key'];

interface SeedProduct {
  sku: string;
  name: string;
  category: CategoryKey;
  /** Lower-case words; the first sport whose name contains one of them is linked. */
  sport?: string[];
  price: number;
  stock?: number;
  description?: string;
}

const BADMINTON = ['cầu lông', 'badminton'];
const FOOTBALL = ['bóng đá', 'football'];
const TENNIS = ['tennis', 'quần vợt'];
const PICKLEBALL = ['pickleball'];

const PRODUCTS: SeedProduct[] = [
  { sku: 'DRK-AQUA-500', name: 'Nước suối Aquafina 500ml', category: 'drinks', price: 10_000, stock: 120 },
  { sku: 'DRK-REVIVE-500', name: 'Revive chanh muối 500ml', category: 'drinks', price: 15_000, stock: 60 },
  { sku: 'DRK-POCARI-500', name: 'Pocari Sweat 500ml', category: 'drinks', price: 20_000, stock: 4 },
  { sku: 'DRK-REDBULL', name: 'Red Bull lon 250ml', category: 'drinks', price: 15_000, stock: 40 },
  {
    sku: 'BAD-SHUTTLE-12',
    name: 'Ống cầu lông Thành Công (12 quả)',
    category: 'gear',
    sport: BADMINTON,
    price: 230_000,
    stock: 25,
  },
  {
    sku: 'BAD-GRIP',
    name: 'Quấn cán vợt Yonex AC102',
    category: 'gear',
    sport: BADMINTON,
    price: 35_000,
    stock: 50,
  },
  {
    sku: 'BAD-RACKET-NF',
    name: 'Vợt Yonex Nanoflare 001',
    category: 'gear',
    sport: BADMINTON,
    price: 950_000,
    stock: 6,
    description: 'Vợt nhẹ, thiên công thủ toàn diện, phù hợp người mới chơi.',
  },
  { sku: 'FB-BALL-5', name: 'Bóng đá Động Lực số 5', category: 'gear', sport: FOOTBALL, price: 320_000, stock: 10 },
  { sku: 'FB-SHIN', name: 'Bọc ống đồng', category: 'gear', sport: FOOTBALL, price: 90_000, stock: 2 },
  { sku: 'TN-BALL-3', name: 'Bóng tennis Wilson (hộp 3)', category: 'gear', sport: TENNIS, price: 160_000, stock: 18 },
  {
    sku: 'PB-BALL',
    name: 'Bóng pickleball Franklin X-40',
    category: 'gear',
    sport: PICKLEBALL,
    price: 45_000,
    stock: 30,
  },
  { sku: 'APP-TOWEL', name: 'Khăn thể thao microfiber', category: 'apparel', price: 60_000, stock: 35 },
  { sku: 'APP-SOCKS', name: 'Tất thể thao cổ ngắn', category: 'apparel', price: 40_000, stock: 0 },
  { sku: 'APP-HEADBAND', name: 'Băng trán thấm mồ hôi', category: 'apparel', price: 30_000, stock: 22 },
];

const main = async () => {
  const sports = await prisma.sport.findMany({ where: { deletedAt: null }, select: { id: true, name: true } });
  const sportFor = (words?: string[]) =>
    words ? (sports.find(({ name }) => words.some((word) => name.toLowerCase().includes(word)))?.id ?? null) : null;

  for (const category of CATEGORIES) {
    const id = idOf(`category:${category.key}`);
    await prisma.productCategory.upsert({
      where: { id },
      create: { id, name: category.name, sortOrder: category.sortOrder },
      update: { name: category.name, sortOrder: category.sortOrder, isActive: true, deletedAt: null },
    });
  }

  let created = 0;
  for (const product of PRODUCTS) {
    const id = idOf(`product:${product.sku}`);
    const data = {
      sku: product.sku,
      name: product.name,
      description: product.description ?? null,
      categoryId: idOf(`category:${product.category}`),
      sportId: sportFor(product.sport),
      price: product.price,
      isActive: true,
      deletedAt: null,
    };
    if (await prisma.product.findUnique({ where: { id }, select: { id: true } })) {
      await prisma.product.update({ where: { id }, data });
      continue;
    }
    const stock = product.stock ?? 0;
    await prisma.$transaction(async (tx) => {
      await tx.product.create({ data: { id, ...data, stock } });
      if (stock > 0) {
        await tx.stockMovement.create({
          data: { productId: id, reason: 'IMPORT', delta: stock, stockAfter: stock, note: 'Tồn kho ban đầu (seed)' },
        });
      }
    });
    created += 1;
  }

  console.log(`Shop: ${CATEGORIES.length} categories, ${PRODUCTS.length} products (${created} new).`);
};

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
