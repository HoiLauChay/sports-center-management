import type { ListMyOrdersQuery, ListOrdersQuery } from '@sports-center/shared';
import type { Request, Response } from 'express';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ResponseClient } from '~/rules/response';
import orderService from '~/services/order.service';

const sendPdf = (res: Response, { fileName, pdf }: { fileName: string; pdf: Uint8Array }) => {
  res.status(HTTP_STATUS.OK).type('application/pdf').attachment(fileName).send(Buffer.from(pdf));
};

class OrderController {
  listMine = async (req: Request, res: Response) => {
    const page = await orderService.listMine(req.user!.id, req.query as unknown as ListMyOrdersQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: page }));
  };

  list = async (req: Request, res: Response) => {
    const page = await orderService.list(req.query as unknown as ListOrdersQuery);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: page }));
  };

  getById = async (req: Request, res: Response) => {
    const order = await orderService.get(req.user!, req.params.id as string);
    res.status(HTTP_STATUS.OK).json(new ResponseClient({ message: 'Thành công', result: order }));
  };

  paymentReceipt = async (req: Request, res: Response) => {
    sendPdf(res, await orderService.paymentReceipt(req.user!, req.params.id as string));
  };

  refundReceipt = async (req: Request, res: Response) => {
    sendPdf(
      res,
      await orderService.refundReceipt(req.user!, req.params.id as string, req.params.transactionId as string),
    );
  };
}

export default new OrderController();
