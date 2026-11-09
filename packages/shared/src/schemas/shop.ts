import { z } from 'zod';

import { FULFILLMENT_STATUSES, MANUAL_STOCK_REASONS } from '../constants/enums';
import { MAX_MONEY } from '../constants/money';
import { optionalText, optionalUrl } from './account';
import { pageQuerySchema } from './pagination';

const MAX_STOCK = 1_000_000;

const nameSchema = (label: string, max: number) =>
  z
    .string(`${label} không được để trống`)
    .trim()
    .min(1, `${label} không được để trống`)
    .max(max, `${label} tối đa ${max} ký tự`);

const countSchema = (label: string, min: number, max: number) =>
  z
    .int(`${label} phải là số nguyên`)
    .min(min, min === 0 ? `${label} không được âm` : `${label} tối thiểu là ${min}`)
    .max(max, `${label} quá lớn`);

const searchText = z.string().trim().max(100).optional();
const flag = (label: string) => z.stringbool(`${label} không hợp lệ`).optional();

export const createProductCategoryBodySchema = z.object({
  name: nameSchema('Tên danh mục', 100),
  sortOrder: countSchema('Thứ tự', 0, 10_000).default(0),
  isActive: z.boolean('Trạng thái không hợp lệ').default(true),
});

export const updateProductCategoryBodySchema = z
  .object({
    name: nameSchema('Tên danh mục', 100),
    sortOrder: countSchema('Thứ tự', 0, 10_000),
    isActive: z.boolean('Trạng thái không hợp lệ'),
  })
  .partial();

const productFields = {
  sku: z
    .string('Mã SKU không được để trống')
    .trim()
    .toUpperCase()
    .min(2, 'Mã SKU tối thiểu 2 ký tự')
    .max(50, 'Mã SKU tối đa 50 ký tự')
    .regex(/^[A-Z0-9_-]+$/, 'Mã SKU chỉ gồm chữ, số, gạch ngang và gạch dưới'),
  name: nameSchema('Tên sản phẩm', 255),
  description: optionalText(5000, 'Mô tả'),
  imageUrl: optionalUrl('Ảnh sản phẩm'),
  categoryId: z.uuid('Danh mục không hợp lệ'),
  sportId: z.uuid('Bộ môn không hợp lệ').nullable(),
  price: z.int('Giá phải là số nguyên').min(0, 'Giá không được âm').max(MAX_MONEY, 'Giá quá lớn'),
  lowStockThreshold: countSchema('Ngưỡng sắp hết hàng', 0, MAX_STOCK),
  isActive: z.boolean('Trạng thái không hợp lệ'),
};

export const createProductBodySchema = z.object({
  ...productFields,
  sportId: productFields.sportId.default(null),
  lowStockThreshold: productFields.lowStockThreshold.default(5),
  isActive: productFields.isActive.default(true),
  /** Opening stock, recorded as the first IMPORT movement. */
  initialStock: countSchema('Tồn kho ban đầu', 0, MAX_STOCK).default(0),
});

export const updateProductBodySchema = z.object(productFields).partial();

export const listProductsQuerySchema = pageQuerySchema.extend({
  q: searchText,
  categoryId: z.uuid('Danh mục không hợp lệ').optional(),
  sportId: z.uuid('Bộ môn không hợp lệ').optional(),
  /** Manager only: also list hidden products. */
  includeInactive: flag('Bộ lọc'),
  lowStock: flag('Bộ lọc'),
});

export const adjustStockBodySchema = z.object({
  reason: z.enum(MANUAL_STOCK_REASONS, 'Lý do không hợp lệ'),
  delta: z
    .int('Số lượng phải là số nguyên')
    .min(-MAX_STOCK, 'Số lượng quá lớn')
    .max(MAX_STOCK, 'Số lượng quá lớn')
    .refine((delta) => delta !== 0, 'Số lượng phải khác 0'),
  note: optionalText(500, 'Ghi chú'),
});

export const listProductSalesQuerySchema = pageQuerySchema.extend({
  q: searchText,
  status: z.enum(FULFILLMENT_STATUSES, 'Trạng thái không hợp lệ').optional(),
});

export const cancelProductSaleBodySchema = z.object({
  reason: optionalText(500, 'Lý do'),
});

export const shopReportQuerySchema = z
  .object({
    from: z.iso.date('Ngày bắt đầu không hợp lệ'),
    to: z.iso.date('Ngày kết thúc không hợp lệ'),
  })
  .refine(({ from, to }) => from <= to, { path: ['to'], message: 'Ngày kết thúc phải từ ngày bắt đầu trở đi' });

export const shopIdParamsSchema = z.object({ id: z.uuid('Mã không hợp lệ') });

export type CreateProductCategoryBody = z.infer<typeof createProductCategoryBodySchema>;
export type UpdateProductCategoryBody = z.infer<typeof updateProductCategoryBodySchema>;
export type CreateProductBody = z.infer<typeof createProductBodySchema>;
export type CreateProductInput = z.input<typeof createProductBodySchema>;
export type UpdateProductBody = z.infer<typeof updateProductBodySchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export type ListProductsInput = z.input<typeof listProductsQuerySchema>;
export type AdjustStockBody = z.infer<typeof adjustStockBodySchema>;
export type ListProductSalesQuery = z.infer<typeof listProductSalesQuerySchema>;
export type ListProductSalesInput = z.input<typeof listProductSalesQuerySchema>;
export type CancelProductSaleBody = z.infer<typeof cancelProductSaleBodySchema>;
export type ShopReportQuery = z.infer<typeof shopReportQuerySchema>;
