import {
  ERROR_CODE,
  type AdjustStockBody,
  type CreateProductBody,
  type CreateProductCategoryBody,
  type ListProductSalesQuery,
  type ListProductsQuery,
  type PageQuery,
  type ShopReport,
  type ShopReportQuery,
  type UpdateProductBody,
  type UpdateProductCategoryBody,
} from '@sports-center/shared';

import { CRON } from '~/constants/cron';
import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Prisma, Role } from '~/generated/prisma/client';
import {
  toProductCategoryResponse,
  toProductResponse,
  toProductSaleResponse,
  toStockMovementResponse,
} from '~/mappers/shop.mapper';
import shopRepository, { type ProductRow, type ProductSaleRow } from '~/repositories/shop.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import notificationService, { type CreatedNotification } from '~/services/notification.service';
import refundService from '~/services/refund.service';
import uploadService from '~/services/upload.service';
import { isUniqueViolation } from '~/utils/dbError';
import { toPage } from '~/utils/pagination';
import { formatCenterDateTime, toCenterDateTime } from '~/utils/time';
import { lockRows, runTransaction } from '~/utils/transaction';

interface Actor {
  id: string;
  role: Role;
}

/** How long before the pickup deadline a member is reminded to collect their order. */
const PICKUP_REMINDER_MS = 6 * 60 * 60 * 1000;

const isStaff = (role: Role) => role === 'MANAGER' || role === 'RECEPTIONIST';

const fail = (status: number, code: (typeof ERROR_CODE)[keyof typeof ERROR_CODE], message: string, path?: string) =>
  new ErrorWithStatus({ status, code, message, ...(path && { errors: [{ path, message }] }) });

const categoryNotFound = () => fail(HTTP_STATUS.NOT_FOUND, ERROR_CODE.NOT_FOUND, 'Không tìm thấy danh mục');
const productNotFound = () => fail(HTTP_STATUS.NOT_FOUND, ERROR_CODE.NOT_FOUND, 'Không tìm thấy sản phẩm');
const saleNotFound = () => fail(HTTP_STATUS.NOT_FOUND, ERROR_CODE.NOT_FOUND, 'Không tìm thấy đơn hàng sản phẩm');
const invalid = (path: string, message: string) =>
  new ErrorWithStatus({
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    code: ERROR_CODE.VALIDATION,
    message: 'Dữ liệu không hợp lệ',
    errors: [{ path, message }],
  });

const withUniqueChecks = async <T>(fn: () => Promise<T>) => {
  try {
    return await fn();
  } catch (err) {
    if (isUniqueViolation(err, 'uq_products_sku')) {
      throw fail(HTTP_STATUS.CONFLICT, ERROR_CODE.CONFLICT, 'Mã SKU đã tồn tại', 'body.sku');
    }
    if (isUniqueViolation(err, 'uq_product_categories_name')) {
      throw fail(HTTP_STATUS.CONFLICT, ERROR_CODE.NAME_TAKEN, 'Tên danh mục đã tồn tại', 'body.name');
    }
    throw err;
  }
};

const withReserved = async (rows: ProductRow[]) => {
  const reserved = await shopRepository.reservedByProduct(rows.map(({ id }) => id));
  return rows.map((row) => toProductResponse(row, reserved.get(row.id) ?? 0));
};

const buyerIdOf = (sale: ProductSaleRow) => sale.orderItem.order.account?.id ?? null;

class ShopService {
  // ---------------------------------------------------------------- categories

  listCategories = async (actor: Actor, includeInactive = false) =>
    (await shopRepository.findCategories(includeInactive && actor.role === 'MANAGER')).map(toProductCategoryResponse);

  createCategory = async (managerId: string, body: CreateProductCategoryBody, ip?: string) =>
    toProductCategoryResponse(
      await withUniqueChecks(() =>
        runTransaction(async (tx) => {
          const created = await shopRepository.createCategory(body, tx);
          await auditService.record(
            {
              accountId: managerId,
              action: 'CREATE',
              entityType: 'PRODUCT_CATEGORY',
              entityId: created.id,
              newValues: created,
              ipAddress: ip,
            },
            tx,
          );
          return created;
        }),
      ),
    );

  updateCategory = async (managerId: string, id: string, body: UpdateProductCategoryBody, ip?: string) =>
    toProductCategoryResponse(
      await withUniqueChecks(() =>
        runTransaction(async (tx) => {
          const current = await shopRepository.findCategory(id, tx);
          if (!current) throw categoryNotFound();
          const updated = await shopRepository.updateCategory(id, body, tx);
          await auditService.record(
            {
              accountId: managerId,
              action: 'UPDATE',
              entityType: 'PRODUCT_CATEGORY',
              entityId: id,
              oldValues: current,
              newValues: updated,
              ipAddress: ip,
            },
            tx,
          );
          return updated;
        }),
      ),
    );

  removeCategory = async (managerId: string, id: string, ip?: string) => {
    await runTransaction(async (tx) => {
      const current = await shopRepository.findCategory(id, tx);
      if (!current) throw categoryNotFound();
      if ((await shopRepository.countProductsInCategory(id, tx)) > 0) {
        throw fail(
          HTTP_STATUS.CONFLICT,
          ERROR_CODE.HAS_DEPENDENCIES,
          'Danh mục còn sản phẩm, hãy chuyển hoặc xóa sản phẩm trước',
        );
      }
      await shopRepository.updateCategory(id, { isActive: false, deletedAt: new Date() }, tx);
      await auditService.record(
        {
          accountId: managerId,
          action: 'DELETE',
          entityType: 'PRODUCT_CATEGORY',
          entityId: id,
          oldValues: current,
          ipAddress: ip,
        },
        tx,
      );
    });
  };

  // ---------------------------------------------------------------- products

  listProducts = async (actor: Actor, query: ListProductsQuery) => {
    const [rows, total] = await shopRepository.findProductPage(query, actor.role === 'MANAGER');
    return toPage(await withReserved(rows), total, query);
  };

  getProduct = async (actor: Actor, id: string) => {
    const row =
      actor.role === 'MANAGER' ? await shopRepository.findProduct(id) : await shopRepository.findVisibleProduct(id);
    if (!row) throw productNotFound();
    return (await withReserved([row]))[0]!;
  };

  private assertReferences = async (tx: Prisma.TransactionClient, body: UpdateProductBody) => {
    if (body.categoryId && !(await shopRepository.findCategory(body.categoryId, tx))) {
      throw invalid('body.categoryId', 'Danh mục không tồn tại');
    }
    if (body.sportId && !(await shopRepository.sportExists(body.sportId, tx))) {
      throw invalid('body.sportId', 'Bộ môn không tồn tại');
    }
  };

  createProduct = async (managerId: string, { initialStock, ...body }: CreateProductBody, ip?: string) => {
    uploadService.assertUploadedFile(body.imageUrl, null, 'PRODUCT_IMAGE', managerId, 'body.imageUrl');

    const row = await withUniqueChecks(() =>
      runTransaction(async (tx) => {
        await this.assertReferences(tx, body);
        const created = await shopRepository.createProduct({ ...body, stock: initialStock }, tx);
        if (initialStock > 0) {
          await shopRepository.createMovement(
            {
              productId: created.id,
              reason: 'IMPORT',
              delta: initialStock,
              stockAfter: initialStock,
              note: 'Tồn kho ban đầu',
              createdById: managerId,
            },
            tx,
          );
        }
        await auditService.record(
          {
            accountId: managerId,
            action: 'CREATE',
            entityType: 'PRODUCT',
            entityId: created.id,
            newValues: created,
            ipAddress: ip,
          },
          tx,
        );
        return created;
      }),
    );
    return toProductResponse(row);
  };

  updateProduct = async (managerId: string, id: string, body: UpdateProductBody, ip?: string) => {
    const row = await withUniqueChecks(() =>
      runTransaction(async (tx) => {
        const current = await shopRepository.findProduct(id, tx);
        if (!current) throw productNotFound();
        uploadService.assertUploadedFile(body.imageUrl, current.imageUrl, 'PRODUCT_IMAGE', managerId, 'body.imageUrl');
        await this.assertReferences(tx, body);

        const updated = await shopRepository.updateProduct(id, body, tx);
        await auditService.record(
          {
            accountId: managerId,
            action: 'UPDATE',
            entityType: 'PRODUCT',
            entityId: id,
            oldValues: current,
            newValues: updated,
            ipAddress: ip,
          },
          tx,
        );
        return updated;
      }),
    );
    return (await withReserved([row]))[0]!;
  };

  removeProduct = async (managerId: string, id: string, ip?: string) => {
    await runTransaction(async (tx) => {
      await lockRows(tx, { products: [id] });
      const current = await shopRepository.findProduct(id, tx);
      if (!current) throw productNotFound();
      if (await shopRepository.hasPendingSales(id, tx)) {
        throw fail(
          HTTP_STATUS.CONFLICT,
          ERROR_CODE.HAS_DEPENDENCIES,
          'Sản phẩm còn đơn online chờ nhận, hãy giao hoặc hủy các đơn đó trước',
        );
      }
      await shopRepository.updateProduct(id, { isActive: false, deletedAt: new Date() }, tx);
      await auditService.record(
        {
          accountId: managerId,
          action: 'DELETE',
          entityType: 'PRODUCT',
          entityId: id,
          oldValues: current,
          ipAddress: ip,
        },
        tx,
      );
    });
  };

  adjustStock = async (managerId: string, id: string, body: AdjustStockBody) => {
    if (body.reason === 'IMPORT' && body.delta < 0) {
      throw invalid('body.delta', 'Nhập kho phải là số dương');
    }
    return runTransaction(async (tx) => {
      await lockRows(tx, { products: [id] });
      const product = await shopRepository.findProduct(id, tx);
      if (!product) throw productNotFound();
      const stockAfter = await shopRepository.changeStock(id, body.delta, tx);
      if (stockAfter === null) {
        throw invalid('body.delta', `Tồn kho hiện chỉ còn ${product.stock}, không thể trừ ${-body.delta}`);
      }
      const movement = await shopRepository.createMovement(
        { productId: id, reason: body.reason, delta: body.delta, stockAfter, note: body.note, createdById: managerId },
        tx,
      );
      return toStockMovementResponse(movement);
    });
  };

  listMovements = async (id: string, query: PageQuery) => {
    if (!(await shopRepository.findProduct(id))) throw productNotFound();
    const [rows, total] = await shopRepository.findMovements(id, query);
    return toPage(rows.map(toStockMovementResponse), total, query);
  };

  // ---------------------------------------------------------------- sales

  listSales = async (query: ListProductSalesQuery) => {
    const [rows, total] = await shopRepository.findSalePage(query);
    return toPage(rows.map(toProductSaleResponse), total, query);
  };

  getSale = async (actor: Actor, id: string) => {
    const sale = await shopRepository.findSale(id);
    if (!sale || (!isStaff(actor.role) && buyerIdOf(sale) !== actor.id)) throw saleNotFound();
    return toProductSaleResponse(sale);
  };

  pickup = async (staffId: string, id: string) => {
    let notifications: CreatedNotification[] = [];
    const sale = await runTransaction(async (tx) => {
      const current = await shopRepository.findSale(id, tx);
      if (!current) throw saleNotFound();
      const { count } = await shopRepository.updateSaleStatus(
        id,
        'PENDING_PICKUP',
        { status: 'PICKED_UP', pickedUpAt: new Date(), pickedUpById: staffId },
        tx,
      );
      if (count === 0) {
        throw fail(
          HTTP_STATUS.CONFLICT,
          ERROR_CODE.INVALID_STATE,
          current.status === 'PICKED_UP' ? 'Đơn đã được giao trước đó' : 'Đơn đã bị hủy, không thể giao',
        );
      }
      const buyerId = buyerIdOf(current);
      if (buyerId) {
        notifications = await notificationService.create(
          [
            {
              accountId: buyerId,
              type: 'SHOP',
              title: 'Đã nhận hàng',
              message: `Bạn đã nhận ${current.quantity} × ${current.product.name} (đơn ${current.orderItem.order.orderNumber}).`,
              referenceType: 'ORDER',
              referenceId: current.orderItem.order.id,
              dedupKey: `shop-picked:${id}`,
            },
          ],
          tx,
        );
      }
      return (await shopRepository.findSale(id, tx))!;
    });
    notificationService.sendEmailsAfterCommit(notifications);
    return toProductSaleResponse(sale);
  };

  cancel = async (actor: Actor, id: string, reason?: string | null) => {
    const found = await shopRepository.findSale(id);
    if (!found || (!isStaff(actor.role) && buyerIdOf(found) !== actor.id)) throw saleNotFound();

    let notifications: CreatedNotification[] = [];
    const result = await runTransaction(async (tx) => {
      const outcome = await this.cancelLocked(tx, found, {
        reason:
          reason ?? (actor.role === 'MEMBER' ? 'Thành viên hủy đơn chưa nhận' : 'Quầy hủy đơn chưa nhận theo yêu cầu'),
        actorId: actor.role === 'MEMBER' ? undefined : actor.id,
      });
      notifications = outcome.notifications;
      return { sale: toProductSaleResponse((await shopRepository.findSale(id, tx))!), refund: outcome.refunded };
    });
    notificationService.sendEmailsAfterCommit(notifications);
    return result;
  };

  /** Cancels a pending pickup: puts the units back on sale and refunds the line to the buyer's wallet. */
  private cancelLocked = async (
    tx: Prisma.TransactionClient,
    found: ProductSaleRow,
    { reason, actorId }: { reason: string; actorId?: string },
  ) => {
    const buyerId = buyerIdOf(found);
    await lockRows(tx, {
      accounts: buyerId ? [buyerId] : [],
      memberProfiles: buyerId ? [buyerId] : [],
      products: [found.productId],
    });

    const now = new Date();
    const { count } = await shopRepository.updateSaleStatus(
      found.id,
      'PENDING_PICKUP',
      { status: 'CANCELLED', cancelledAt: now },
      tx,
    );
    if (count === 0) {
      const current = (await shopRepository.findSale(found.id, tx))!;
      throw fail(
        HTTP_STATUS.CONFLICT,
        ERROR_CODE.INVALID_STATE,
        current.status === 'PICKED_UP' ? 'Hàng đã được giao, không thể hủy' : 'Đơn đã được hủy trước đó',
      );
    }

    const stockAfter = (await shopRepository.changeStock(found.productId, found.quantity, tx))!;
    await shopRepository.createMovement(
      {
        productId: found.productId,
        reason: 'SALE_CANCEL',
        delta: found.quantity,
        stockAfter,
        note: reason,
        saleId: found.id,
        createdById: actorId,
      },
      tx,
    );

    return refundService.refundItem(tx, { orderItemId: found.orderItemId, reason, createdById: actorId });
  };

  // ---------------------------------------------------------------- jobs

  /** Cron: cancels pickups past their deadline (refund + restock) and reminds members of ones due soon. */
  runPickupJob = async (now = new Date()) => {
    const expired = await shopRepository.findExpiredSaleIds(now, CRON.BATCH_SIZE);
    let cancelled = 0;
    for (const { id } of expired) {
      const found = await shopRepository.findSale(id);
      if (!found) continue;
      try {
        const outcome = await runTransaction((tx) =>
          this.cancelLocked(tx, found, { reason: 'Quá hạn nhận hàng tại quầy' }),
        );
        notificationService.sendEmailsAfterCommit(outcome.notifications);
        cancelled += 1;
      } catch (err) {
        // Picked up or cancelled while this job ran: nothing left to do for this sale.
        if (!(err instanceof ErrorWithStatus && err.code === ERROR_CODE.INVALID_STATE)) throw err;
      }
    }

    const dueSoon = await shopRepository.findSalesDueBefore(now, new Date(now.getTime() + PICKUP_REMINDER_MS));
    const reminders = dueSoon.flatMap((sale) => {
      const buyerId = buyerIdOf(sale);
      return buyerId
        ? [
            {
              accountId: buyerId,
              type: 'SHOP' as const,
              title: 'Sắp hết hạn nhận hàng',
              message: `Đơn ${sale.orderItem.order.orderNumber} (${sale.quantity} × ${sale.product.name}) cần được nhận tại quầy trước ${formatCenterDateTime(sale.pickupDeadline!)}, sau đó đơn sẽ tự hủy và hoàn tiền về ví.`,
              referenceType: 'ORDER',
              referenceId: sale.orderItem.order.id,
              dedupKey: `shop-pickup-reminder:${sale.id}`,
              sendEmail: true,
            },
          ]
        : [];
    });
    const created = reminders.length > 0 ? await notificationService.create(reminders) : [];
    notificationService.sendEmailsAfterCommit(created);

    return { processed: cancelled + created.length, remaining: await shopRepository.countExpiredSales(now) };
  };

  // ---------------------------------------------------------------- report

  report = async ({ from, to }: ShopReportQuery): Promise<ShopReport> => {
    const [lines, lowStock, pendingPickups] = await Promise.all([
      shopRepository.findSoldLines(toCenterDateTime(from, 0), toCenterDateTime(to, 24 * 60)),
      shopRepository.findLowStock(),
      shopRepository.countPendingPickups(),
    ]);

    const products = new Map<string, ShopReport['topProducts'][number]>();
    const categories = new Map<string, ShopReport['byCategory'][number]>();
    const orders = new Set<string>();
    let revenue = 0;
    let units = 0;
    for (const { quantity, orderItem, product } of lines) {
      const amount = Number(orderItem.totalAmount);
      revenue += amount;
      units += quantity;
      orders.add(orderItem.orderId);
      const byProduct = products.get(product.id) ?? {
        product: { id: product.id, sku: product.sku, name: product.name },
        units: 0,
        revenue: 0,
      };
      byProduct.units += quantity;
      byProduct.revenue += amount;
      products.set(product.id, byProduct);
      const byCategory = categories.get(product.category.id) ?? { category: product.category, units: 0, revenue: 0 };
      byCategory.units += quantity;
      byCategory.revenue += amount;
      categories.set(product.category.id, byCategory);
    }

    return {
      revenue,
      units,
      orders: orders.size,
      topProducts: [...products.values()].sort((a, b) => b.revenue - a.revenue || b.units - a.units).slice(0, 10),
      byCategory: [...categories.values()].sort((a, b) => b.revenue - a.revenue),
      lowStock,
      pendingPickups,
    };
  };
}

export default new ShopService();
