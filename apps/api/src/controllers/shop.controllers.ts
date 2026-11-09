import type {
  AdjustStockBody,
  CancelProductSaleBody,
  ListProductSalesQuery,
  ListProductsQuery,
  PageQuery,
  ShopReportQuery,
} from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import shopService from '~/services/shop.service';
import { getClientIp } from '~/utils/request';

const ok = (res: Response, result: unknown, message = 'Thành công', status: number = HTTP_STATUS.OK) =>
  res.status(status).json(new ResponseClient({ message, result }));

const idOf = (req: Request) => req.params.id as string;

class ShopController {
  listCategories = async (req: Request, res: Response) => {
    ok(res, await shopService.listCategories(req.user!, req.query.includeInactive === 'true'));
  };

  createCategory = async (req: Request, res: Response) => {
    const result = await shopService.createCategory(req.user!.id, req.body, getClientIp(req));
    ok(res, result, 'Đã tạo danh mục', HTTP_STATUS.CREATED);
  };

  updateCategory = async (req: Request, res: Response) => {
    ok(
      res,
      await shopService.updateCategory(req.user!.id, idOf(req), req.body, getClientIp(req)),
      'Đã cập nhật danh mục',
    );
  };

  removeCategory = async (req: Request, res: Response) => {
    await shopService.removeCategory(req.user!.id, idOf(req), getClientIp(req));
    ok(res, undefined, 'Đã xóa danh mục');
  };

  listProducts = async (req: Request, res: Response) => {
    ok(res, await shopService.listProducts(req.user!, req.query as unknown as ListProductsQuery));
  };

  getProduct = async (req: Request, res: Response) => {
    ok(res, await shopService.getProduct(req.user!, idOf(req)));
  };

  createProduct = async (req: Request, res: Response) => {
    const result = await shopService.createProduct(req.user!.id, req.body, getClientIp(req));
    ok(res, result, 'Đã tạo sản phẩm', HTTP_STATUS.CREATED);
  };

  updateProduct = async (req: Request, res: Response) => {
    ok(
      res,
      await shopService.updateProduct(req.user!.id, idOf(req), req.body, getClientIp(req)),
      'Đã cập nhật sản phẩm',
    );
  };

  removeProduct = async (req: Request, res: Response) => {
    await shopService.removeProduct(req.user!.id, idOf(req), getClientIp(req));
    ok(res, undefined, 'Đã xóa sản phẩm');
  };

  adjustStock = async (req: Request, res: Response) => {
    const result = await shopService.adjustStock(req.user!.id, idOf(req), req.body as AdjustStockBody);
    ok(res, result, 'Đã cập nhật tồn kho', HTTP_STATUS.CREATED);
  };

  listMovements = async (req: Request, res: Response) => {
    ok(res, await shopService.listMovements(idOf(req), req.query as unknown as PageQuery));
  };

  listSales = async (req: Request, res: Response) => {
    ok(res, await shopService.listSales(req.query as unknown as ListProductSalesQuery));
  };

  getSale = async (req: Request, res: Response) => {
    ok(res, await shopService.getSale(req.user!, idOf(req)));
  };

  pickup = async (req: Request, res: Response) => {
    ok(res, await shopService.pickup(req.user!.id, idOf(req)), 'Đã giao hàng');
  };

  cancel = async (req: Request, res: Response) => {
    const { reason } = req.body as CancelProductSaleBody;
    ok(res, await shopService.cancel(req.user!, idOf(req), reason), 'Đã hủy đơn và hoàn tiền');
  };

  report = async (req: Request, res: Response) => {
    ok(res, await shopService.report(req.query as unknown as ShopReportQuery));
  };
}

export default new ShopController();
