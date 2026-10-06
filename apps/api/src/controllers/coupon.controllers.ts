import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import couponService from '~/services/coupon.service';
import { getClientIp } from '~/utils/request';

class CouponController {
  list = async (_req: Request, res: Response) => {
    const coupons = await couponService.list();
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: coupons }));
  };

  create = async (req: Request, res: Response) => {
    const coupon = await couponService.create(req.user!.id, req.body, getClientIp(req));
    res.status(HTTP_STATUS.CREATED).json(new ResponseClient({ message: 'Đã tạo mã giảm giá', result: coupon }));
  };

  update = async (req: Request, res: Response) => {
    const coupon = await couponService.update(req.user!.id, req.params.id as string, req.body, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã cập nhật mã giảm giá', result: coupon }));
  };

  remove = async (req: Request, res: Response) => {
    await couponService.remove(req.user!.id, req.params.id as string, getClientIp(req));
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Đã xóa mã giảm giá' }));
  };
}

export default new CouponController();
