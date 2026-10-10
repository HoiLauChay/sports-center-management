import { ERROR_CODE, type CreateCouponBody, type UpdateCouponBody } from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Prisma } from '~/generated/prisma/client';
import { toCouponResponse } from '~/mappers/coupon.mapper';
import couponRepository, { type CouponRow } from '~/repositories/coupon.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import { isUniqueViolation } from '~/utils/dbError';
import { runTransaction } from '~/utils/transaction';

const notFound = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.NOT_FOUND,
    code: ERROR_CODE.NOT_FOUND,
    message: 'Không tìm thấy mã giảm giá',
  });

const codeTaken = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.CONFLICT,
    code: ERROR_CODE.CONFLICT,
    message: 'Mã giảm giá đã tồn tại',
    errors: [{ path: 'body.code', message: 'Mã giảm giá đã tồn tại' }],
  });

const invalid = (path: string, message: string) =>
  new ErrorWithStatus({
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    code: ERROR_CODE.VALIDATION,
    message: 'Dữ liệu không hợp lệ',
    errors: [{ path, message }],
  });

const toData = (body: UpdateCouponBody): Prisma.CouponUpdateInput => ({
  ...body,
  applicableTypes: body.applicableTypes === undefined ? undefined : (body.applicableTypes ?? []),
  validFrom: body.validFrom ? new Date(body.validFrom) : undefined,
  validTo: body.validTo ? new Date(body.validTo) : undefined,
});

const assertConsistent = (current: CouponRow | null, body: UpdateCouponBody) => {
  const discountType = body.discountType ?? current?.discountType;
  const discountValue = body.discountValue ?? Number(current?.discountValue);
  if (discountType === 'PERCENT' && discountValue > 100) {
    throw invalid('body.discountValue', 'Phần trăm giảm không được vượt quá 100');
  }
  const validFrom = body.validFrom ? new Date(body.validFrom) : current?.validFrom;
  const validTo = body.validTo ? new Date(body.validTo) : current?.validTo;
  if (validFrom && validTo && validTo <= validFrom) {
    throw invalid('body.validTo', 'Thời gian kết thúc phải sau thời gian bắt đầu');
  }
};

const withCodeCheck = async <T>(fn: () => Promise<T>) => {
  try {
    return await fn();
  } catch (err) {
    if (isUniqueViolation(err, 'uq_coupons_code')) throw codeTaken();
    throw err;
  }
};

class CouponService {
  list = async () => {
    const rows = await couponRepository.findAll();
    const used = await couponRepository.countOrders(rows.map(({ id }) => id));
    return rows.map((row) => toCouponResponse(row, used.get(row.id) ?? 0));
  };

  create = async (managerId: string, body: CreateCouponBody, ip?: string) => {
    assertConsistent(null, body);
    const coupon = await withCodeCheck(() =>
      runTransaction(async (tx) => {
        const created = await couponRepository.create(toData(body) as Prisma.CouponCreateInput, tx);
        await auditService.record(
          {
            accountId: managerId,
            action: 'CREATE',
            entityType: 'COUPON',
            entityId: created.id,
            newValues: created,
            ipAddress: ip,
          },
          tx,
        );
        return created;
      }),
    );
    return toCouponResponse(coupon, 0);
  };

  update = async (managerId: string, id: string, body: UpdateCouponBody, ip?: string) => {
    const coupon = await withCodeCheck(() =>
      runTransaction(async (tx) => {
        const current = await couponRepository.findById(id, tx);
        if (!current) throw notFound();
        assertConsistent(current, body);

        const updated = await couponRepository.update(id, toData(body), tx);
        await auditService.record(
          {
            accountId: managerId,
            action: 'UPDATE',
            entityType: 'COUPON',
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
    return toCouponResponse(coupon, (await couponRepository.countOrders([id])).get(id) ?? 0);
  };

  remove = async (managerId: string, id: string, ip?: string) => {
    await runTransaction(async (tx) => {
      const current = await couponRepository.findById(id, tx);
      if (!current) throw notFound();

      await couponRepository.update(id, { isActive: false, deletedAt: new Date() }, tx);
      await auditService.record(
        {
          accountId: managerId,
          action: 'DELETE',
          entityType: 'COUPON',
          entityId: id,
          oldValues: current,
          ipAddress: ip,
        },
        tx,
      );
    });
  };
}

export default new CouponService();
